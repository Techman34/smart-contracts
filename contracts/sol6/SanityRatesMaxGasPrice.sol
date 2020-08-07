pragma solidity 0.6.6;

import "./utils/Utils5.sol";
import "./utils/Withdrawable3.sol";


contract SanityRatesMaxGasPrice is Withdrawable3, Utils5 {
    mapping(address => uint256) public tokenRate;
    mapping(address => uint256) public reasonableDiffInBps;
    uint256 public maxGasPriceWei = 50 * 1000 * 1000 * 1000; // 50 gwei

    event SanityMaxGasPriceSet(uint256 maxGasPrice);

    constructor(address _admin) public Withdrawable3(_admin) {
        require(_admin != address(0), "admin 0");
        admin = _admin;
    }

    function setReasonableDiff(IERC20[] memory srcs, uint256[] memory diff) public onlyAdmin {
        require(srcs.length == diff.length, "srcs,diff length mismatch");
        for (uint256 i = 0; i < srcs.length; i++) {
            require(diff[i] <= 100 * 100, "Diff > 10000 BPS");
            reasonableDiffInBps[address(srcs[i])] = diff[i];
        }
    }

    function setMaxGasPriceWei(uint256 _maxGasPriceWei) public onlyOperator {
        require(_maxGasPriceWei > 0, "maxGasPriceWei must be > 0");
        maxGasPriceWei = _maxGasPriceWei;
        emit SanityMaxGasPriceSet(maxGasPriceWei);
    }

    /// @dev You can disable a token by setting the token's sanity rate to 0
    function setSanityRates(IERC20[] memory srcs, uint256[] memory rates) public onlyOperator {
        require(srcs.length == rates.length, "srcs,rates length mismatch");

        for (uint256 i = 0; i < srcs.length; i++) {
            require(rates[i] <= MAX_RATE, "rate > maxRate (10**25)");
            tokenRate[address(srcs[i])] = rates[i];
        }
    }

    function getSanityRate(IERC20 src, IERC20 dest) public view returns (uint256) {
        if (src != ETH_TOKEN_ADDRESS && dest != ETH_TOKEN_ADDRESS) return 0;
        if (tx.gasprice > maxGasPriceWei) return 0;

        uint256 rate;
        address token;
        if (src == ETH_TOKEN_ADDRESS) {
            rate = tokenRate[address(dest)] > 0
                ? (PRECISION * PRECISION) / tokenRate[address(dest)]
                : 0;
            token = address(dest);
        } else {
            rate = tokenRate[address(src)];
            token = address(src);
        }

        return (rate * (10000 + reasonableDiffInBps[token])) / 10000;
    }
}
