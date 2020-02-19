pragma solidity 0.5.11;

import "../../UtilsV5.sol";

contract MockFeeHandler is Utils {

    mapping(uint => uint) public rewards;

    constructor() public {}

    function () external payable {}

    function setEpochReward(uint epoch) public payable {
        rewards[epoch] = msg.value;
    }

    function claimStakerReward(address payable staker, uint percentInPrecision, uint epoch) public returns(bool) {
        uint reward = rewards[epoch];
        uint rewardToClaim = percentInPrecision * reward / PRECISION;
        require(rewardToClaim <= address(this).balance);
        staker.transfer(rewardToClaim);
        return true;
    }

    function withdrawAllETH() public {
        msg.sender.transfer(address(this).balance);
    }
}