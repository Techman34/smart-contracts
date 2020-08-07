pragma solidity 0.6.6;

import "./utils/Utils5.sol";
import "./utils/Withdrawable3.sol";


contract SanityRatesMaxGasPrice is Withdrawable3, Utils5 {
    struct SanityData {
        uint224 tokenRate;
        uint32 reasonableDiffInBps;
    }

    mapping(address => SanityData) public sanityData;
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
            sanityData[address(srcs[i])].reasonableDiffInBps = uint32(diff[i]);
        }
    }

    function setMaxGasPriceWei(uint256 _maxGasPriceWei) public onlyOperator {
        require(_maxGasPriceWei > 0, "maxGasPriceWei must be > 0");
        maxGasPriceWei = _maxGasPriceWei;
        emit SanityMaxGasPriceSet(maxGasPriceWei);
    }

    function setSanityRates(IERC20[] memory srcs, uint256[] memory rates) public onlyOperator {
        require(srcs.length == rates.length, "srcs,rates length mismatch");

        for (uint256 i = 0; i < srcs.length; i++) {
            require(rates[i] <= MAX_RATE, "rate > maxRate (10**25)");
            sanityData[address(srcs[i])].tokenRate = uint224(rates[i]);
        }
    }

    function getSanityRate(IERC20 src, IERC20 dest) public view returns (uint256) {
        SanityData memory data;

        if (src != ETH_TOKEN_ADDRESS && dest != ETH_TOKEN_ADDRESS) return 0;
        if (tx.gasprice > maxGasPriceWei) return 0;

        uint256 rate;
        if (src == ETH_TOKEN_ADDRESS) {
            data = sanityData[address(dest)];
            rate = (PRECISION * PRECISION) / data.tokenRate;
        } else {
            data = sanityData[address(src)];
            rate = data.tokenRate;
        }

        return (rate * (10000 + data.reasonableDiffInBps)) / 10000;
    }
}
