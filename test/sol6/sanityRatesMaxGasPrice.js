const SanityRates = artifacts.require('SanityRatesMaxGasPrice.sol');
const MockReserveSanity = artifacts.require("MockReserveSanity.sol");
const TestToken = artifacts.require('Token.sol');
const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const Helper = require('../helper.js');
const {BPS, precisionUnits, ethAddress, zeroAddress} = require('../helper.js');
const {web3} = require('@openzeppelin/test-helpers/src/setup');
const BN = web3.utils.BN;
const MAX_RATE = new BN(10).pow(new BN(25)); // 10**25

let sanityRates;
let admin;
let operator;
let numTokens = 5;
let token;
let tokens = [];
let tokenDecimals = [];
let rates = [];
let buyRate = []
let sellRate = [];
let reasonableDiffs = [];

contract('SanityRatesMaxGasPrice', function (accounts) {
  before('init globals and init sanity rates.', async function () {
    admin = accounts[0];
    operator = accounts[5];

    //init tokens
    for (let i = 0; i < numTokens; i++) {
      tokenDecimals[i] = new BN(15).add(new BN(i));
      token = await TestToken.new(`test${i}`, 'tst' + i, tokenDecimals[i]);
      tokens[i] = token.address;
      rates[i] = new BN(i + 1).mul(precisionUnits.div(new BN(10)));
      reasonableDiffs[i] = new BN(i * 100);
    }

    sanityRates = await SanityRates.new(admin);
    await sanityRates.addOperator(operator);

    await sanityRates.setSanityRates(tokens, rates, {from: operator});
    await sanityRates.setReasonableDiff(tokens, reasonableDiffs);
  });

  describe("test sanity rates with maxGasPrice setting", function() {
    it('check rates for token 0 (where diff is 0) so only tests rates.', async function () {
      const tokenToEthRate = await sanityRates.getSanityRate(tokens[0], ethAddress);
      Helper.assertEqual(tokenToEthRate, rates[0], 'unexpected rate');
  
      const expectedEthToToken = precisionUnits.mul(precisionUnits).div(tokenToEthRate);
      const ethToTokenRate = await sanityRates.getSanityRate(ethAddress, tokens[0]);
      Helper.assertEqual(expectedEthToToken, ethToTokenRate, 'unexpected rate');
    });
  
    it('check rates with reasonable diff.', async function () {
      const tokenInd = 1;
      const expectedTokenToEthRate = rates[tokenInd]
        .mul(BPS.add(reasonableDiffs[tokenInd]))
        .div(BPS);
  
      const tokenToEthRate = await sanityRates.getSanityRate(tokens[tokenInd], ethAddress);
      Helper.assertEqual(tokenToEthRate, expectedTokenToEthRate, 'unexpected rate');
  
      const expectedEthToToken = precisionUnits
        .mul(precisionUnits)
        .div(rates[tokenInd])
        .mul(BPS.add(reasonableDiffs[tokenInd]))
        .div(BPS);
      const ethToTokenRate = await sanityRates.getSanityRate(ethAddress, tokens[tokenInd]);
      Helper.assertEqual(expectedEthToToken, ethToTokenRate, 'unexpected rate');
    });
  
    it("should test can't init this contract with empty contracts (address 0).", async function () {
      let sanityRatess;
  
      try {
        sanityRatess = await SanityRates.new(zeroAddress);
        assert(false, 'throw was expected in line above.');
      } catch (e) {
        assert(Helper.isRevertErrorMessage(e), 'expected throw but got: ' + e);
      }
  
      sanityRatess = await SanityRates.new(admin);
    });
  
    it("should test can't init diffs when array lengths aren't the same.", async function () {
      reasonableDiffs.push(8);
  
      await expectRevert(
        sanityRates.setReasonableDiff(tokens, reasonableDiffs),
        'srcs,diff length mismatch'
      );
  
      reasonableDiffs.length = tokens.length;
      await sanityRates.setReasonableDiff(tokens, reasonableDiffs);
    });
  
    it("should test can't init diffs when value > max diff (10000 = 100%).", async function () {
      reasonableDiffs[0] = new BN(10001);
  
      await expectRevert(
        sanityRates.setReasonableDiff(tokens, reasonableDiffs),
        'Diff > 10000 BPS'
      );
  
      reasonableDiffs[0] = new BN(10000);
      await sanityRates.setReasonableDiff(tokens, reasonableDiffs);
    });
  
    it("should test can't init rates when array lengths aren't the same.", async function () {
      rates.push(new BN(8));
  
      await expectRevert(
        sanityRates.setSanityRates(tokens, rates, {from: operator}),
        'srcs,rates length mismatch'
      );
  
      rates.length = tokens.length;
      await sanityRates.setSanityRates(tokens, rates, {from: operator});
    });
  
    it('should test reverts when sanity rate > maxRate (10**25).', async function () {
      const legalRate = MAX_RATE;
      const illegalRate = MAX_RATE.add(new BN(1));
  
      rates[0] = illegalRate;
  
      await expectRevert(
        sanityRates.setSanityRates(tokens, rates, {from: operator}),
        'rate > maxRate (10**25)'
      );
  
      rates[0] = legalRate;
      await sanityRates.setSanityRates(tokens, rates, {from: operator});
    });
  
    it('should test return rate 0 when both are tokens (no ether).', async function () {
      let rate0 = await sanityRates.getSanityRate(tokens[1], tokens[2]);
      Helper.assertEqual(rate0, 0, '0 rate expected');
  
      rate0 = await sanityRates.getSanityRate(tokens[0], tokens[1]);
      Helper.assertEqual(rate0, 0, '0 rate expected');
  
      rate0 = await sanityRates.getSanityRate(tokens[2], tokens[3]);
      Helper.assertEqual(rate0, 0, '0 rate expected');
    });
  
    it('should test setting max gas price.', async function () {
      const gasPrice = web3.utils.toWei('100', 'gwei');
      const txResult = await sanityRates.setMaxGasPriceWei(gasPrice, {from: operator});
  
      expectEvent(txResult, 'SanityMaxGasPriceSet', {
        maxGasPrice: gasPrice
      });
    });
  
    it('should test reverts when not operator is setting max gas price.', async function () {
      const gasPrice = web3.utils.toWei('100', 'gwei');
  
      await expectRevert(
        sanityRates.setMaxGasPriceWei(gasPrice),
        "only operator"
      );
    });
  
    it('should test reverts setting max gas price to 0.', async function () {
      const gasPrice = web3.utils.toWei('0', 'gwei');
  
      await expectRevert(
        sanityRates.setMaxGasPriceWei(gasPrice, {from: operator}),
        "maxGasPriceWei must be > 0"
      );
    });
  
    it('should test sanity rate is 0 when tx gas price > maxGasPrice.', async function () {
      const tokenToEthRate = await sanityRates.getSanityRate(tokens[0], ethAddress, {
        gasPrice: web3.utils.toWei('101', 'gwei'),
      });
      Helper.assertEqual(tokenToEthRate, 0, 'unexpected rate');
    });
  });

  describe("test reserve that uses SanityRatesMaxGasPrice", function() {
    before('setup mock reserve with sanity.', async function () {
      mockReserve = await MockReserveSanity.new();
      await mockReserve.setContracts(sanityRates.address);

      for (let i = 0; i < numTokens; i++) {
        buyRate[i] = precisionUnits.mul(precisionUnits).div(rates[i]);
        sellRate[i] = rates[i];
        await mockReserve.setRate(tokens[i], buyRate[i], sellRate[i]);
      }
    });

    it('should test getting conversion rate.', async function () {
      const amountWei = new BN(2);
      const currentBlock = await Helper.getCurrentBlock();

      let conversionRate;
      for (let i = 0; i < numTokens; i++) {
        conversionRate = await mockReserve.getConversionRate(ethAddress, tokens[i], amountWei, currentBlock);
        Helper.assertEqual(conversionRate, buyRate[i], 'unexpected rate');
        
        conversionRate = await mockReserve.getConversionRate(tokens[i], ethAddress, amountWei, currentBlock);
        Helper.assertEqual(conversionRate, sellRate[i], 'unexpected rate');
      }
    });

    it('should test getting 0 conversion rate when tx gas price > maxGasPrice.', async function () {
      const amountWei = new BN(2);
      const currentBlock = await Helper.getCurrentBlock();

      let conversionRate;
      for (let i = 0; i < numTokens; i++) {
        conversionRate = await mockReserve.getConversionRate(ethAddress, tokens[i], amountWei, currentBlock, {
          gasPrice: web3.utils.toWei('101', 'gwei'),
        });
        Helper.assertEqual(conversionRate, 0, 'unexpected rate');
        
        conversionRate = await mockReserve.getConversionRate(tokens[i], ethAddress, amountWei, currentBlock, {
          gasPrice: web3.utils.toWei('101', 'gwei'),
        });
        Helper.assertEqual(conversionRate, 0, 'unexpected rate');
      }
    });

    it('should test getting 0 conversion rate when token sanity rate is set to 0.', async function () {
      let maxRates = []
      for (let i = 0; i < numTokens; i++) {
        maxRates[i] = 0;
      }
  
      await sanityRates.setSanityRates(tokens, maxRates, {from: operator});

      const amountWei = new BN(2);
      const currentBlock = await Helper.getCurrentBlock();

      let conversionRate;
      for (let i = 0; i < numTokens; i++) {
        conversionRate = await mockReserve.getConversionRate(ethAddress, tokens[i], amountWei, currentBlock);
        Helper.assertEqual(conversionRate, 0, 'unexpected rate');
        
        conversionRate = await mockReserve.getConversionRate(tokens[i], ethAddress, amountWei, currentBlock);
        Helper.assertEqual(conversionRate, 0, 'unexpected rate');
      }
    });
  });
});