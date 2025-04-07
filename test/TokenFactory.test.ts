import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenFactory, CustomToken, LiquidityPool } from "../typechain-types";

describe("TokenFactory", function () {
  let factory: TokenFactory;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    factory = await TokenFactory.deploy();
    await factory.waitForDeployment();
  });

  describe("Initialization", function () {
    it("Should set correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should set correct creation fee", async function () {
      expect(await factory.CREATION_FEE()).to.equal(ethers.parseEther("1"));
    });

    it("Should set correct initial supply", async function () {
      expect(await factory.INITIAL_SUPPLY()).to.equal(ethers.parseEther("1000000"));
    });
  });

  describe("Token Creation", function () {
    it("Should create new token and liquidity pool", async function () {
      const creationFee = await factory.CREATION_FEE();
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";

      await expect(
        factory.connect(user1).createToken(tokenName, tokenSymbol, { value: creationFee })
      ).to.emit(factory, "TokenCreated");

      const tokenId = await factory.tokenIdCounter();
      const tokenInfo = await factory.getTokenInfo(tokenId);

      expect(tokenInfo.tokenAddress).to.not.equal(ethers.ZeroAddress);
      expect(tokenInfo.liquidityPool).to.not.equal(ethers.ZeroAddress);
      expect(tokenInfo.id).to.equal(tokenId);

      const CustomToken = await ethers.getContractFactory("CustomToken");
      const token = CustomToken.attach(tokenInfo.tokenAddress) as CustomToken;
      expect(await token.name()).to.equal(tokenName);
      expect(await token.symbol()).to.equal(tokenSymbol);
    });

    it("Should revert when insufficient creation fee", async function () {
      const insufficientFee = ethers.parseEther("0.004");
      await expect(
        factory.connect(user1).createToken("Test", "TST", { value: insufficientFee })
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should revert when token name is empty", async function () {
      const creationFee = await factory.CREATION_FEE();
      await expect(
        factory.connect(user1).createToken("", "TST", { value: creationFee })
      ).to.be.revertedWith("Token name is required");
    });

    it("Should revert when token symbol is empty", async function () {
      const creationFee = await factory.CREATION_FEE();
      await expect(
        factory.connect(user1).createToken("Test", "", { value: creationFee })
      ).to.be.revertedWith("Token symbol is required");
    });
  });

  describe("Token Information", function () {
    let tokenInfo: any;

    beforeEach(async function () {
      const creationFee = await factory.CREATION_FEE();
      await factory.connect(user1).createToken("Test Token", "TEST", { value: creationFee });
      const tokenId = await factory.tokenIdCounter();
      tokenInfo = await factory.getTokenInfo(tokenId);
    });

    it("Should return correct token info", async function () {
      const tokenId = await factory.tokenIdCounter();
      const info = await factory.getTokenInfo(tokenId);
      expect(info.tokenAddress).to.equal(tokenInfo.tokenAddress);
      expect(info.liquidityPool).to.equal(tokenInfo.liquidityPool);
      expect(info.id).to.equal(tokenId);
    });

    it("Should return correct liquidity pool for token", async function () {
      const poolAddress = await factory.getLiquidityPool(tokenInfo.tokenAddress);
      expect(poolAddress).to.equal(tokenInfo.liquidityPool);
    });
  });

  describe("Events", function () {
    let tokenInfo: any;

    beforeEach(async function () {
      const creationFee = await factory.CREATION_FEE();
      await factory.connect(user1).createToken("Test Token", "TEST", { value: creationFee });
      const tokenId = await factory.tokenIdCounter();
      tokenInfo = await factory.getTokenInfo(tokenId);
    });

    it("Should emit correct swap event", async function () {
      const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
      const pool = await LiquidityPool.attach(tokenInfo.liquidityPool) as LiquidityPool;

      await expect(
        pool.connect(user1).buyTokens({ value: ethers.parseEther("0.1") })
      ).to.emit(factory, "Swap");
    });

    it("Should emit correct sync event", async function () {
      const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
      const pool = await LiquidityPool.attach(tokenInfo.liquidityPool) as LiquidityPool;

      await expect(
        pool.connect(user1).buyTokens({ value: ethers.parseEther("0.1") })
      ).to.emit(factory, "Sync");
    });
  });
}); 