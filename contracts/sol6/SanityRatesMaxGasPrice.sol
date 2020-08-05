pragma solidity 0.6.6;

import "./utils/Utils5.sol";
import "./utils/WithdrawableNoModifiers.sol";


contract SanityRatesMaxGasPrice is WithdrawableNoModifiers, Utils5 {
    mapping(address => uint256) public tokenRate;
    mapping(address => uint256) public reasonableDiffInBps;
    uint256 internal maxGasPriceValue = 50 wei * 1000000000; // 50 gwei

    event SanityMaxGasPriceSet(uint256 maxGasPrice);

    constructor(address _admin) public WithdrawableNoModifiers(_admin) {
        require(_admin != address(0));
        admin = _admin;
    }

    function setReasonableDiff(IERC20[] memory srcs, uint256[] memory diff) public {
        onlyAdmin();
        require(srcs.length == diff.length);
        for (uint256 i = 0; i < srcs.length; i++) {
            require(diff[i] <= 100 * 100);
            reasonableDiffInBps[address(srcs[i])] = diff[i];
        }
    }

    function setMaxGasPrice(uint256 _maxGasPrice) public {
        onlyOperator();
        require(_maxGasPrice > 0);
        maxGasPriceValue = _maxGasPrice;
        emit SanityMaxGasPriceSet(maxGasPriceValue);
    }

    function setSanityRates(IERC20[] memory srcs, uint256[] memory rates) public {
        onlyOperator();
        require(srcs.length == rates.length);

        for (uint256 i = 0; i < srcs.length; i++) {
            require(rates[i] <= MAX_RATE);
            tokenRate[address(srcs[i])] = rates[i];
        }
    }

    function getSanityRate(IERC20 src, IERC20 dest) public view returns (uint256) {
        if (src != ETH_TOKEN_ADDRESS && dest != ETH_TOKEN_ADDRESS) return 0;
        if (tx.gasprice > maxGasPriceValue) return 0;

        uint256 rate;
        address token;
        if (src == ETH_TOKEN_ADDRESS) {
            rate = (PRECISION * PRECISION) / tokenRate[address(dest)];
            token = address(dest);
        } else {
            rate = tokenRate[address(src)];
            token = address(src);
        }

        return (rate * (10000 + reasonableDiffInBps[token])) / 10000;
    }
}
