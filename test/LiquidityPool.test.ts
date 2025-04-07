import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { LiquidityPool, CustomToken, TokenFactory } from "../typechain-types";

describe("LiquidityPool", function () {
    let liquidityPool: LiquidityPool;
    let token: CustomToken;
    let factory: TokenFactory;
    let owner: HardhatEthersSigner;
    let user1: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        const TokenFactory = await ethers.getContractFactory("TokenFactory");
        factory = await TokenFactory.deploy();
        await factory.waitForDeployment();

        const CustomToken = await ethers.getContractFactory("CustomToken");

        // Create token through factory to get proper setup
        const creationFee = await factory.CREATION_FEE();
        await factory.connect(owner).createToken("Test Token", "TEST", { value: creationFee });

        const tokenId = await factory.tokenIdCounter();
        const tokenInfo = await factory.getTokenInfo(tokenId);

        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        liquidityPool = LiquidityPool.attach(tokenInfo.liquidityPool) as LiquidityPool;

        token = CustomToken.attach(tokenInfo.tokenAddress) as CustomToken;
    });

    describe("Price and Reserves", function () {
        it("Should return correct price", async function () {
            const price = await liquidityPool.getPrice();
            expect(price).to.be.gt(0);
        });

        it("Should return correct reserves", async function () {
            const [tokenBalance, ethBalance] = await liquidityPool.getReserves();
            expect(tokenBalance).to.equal(ethers.parseEther("1000000")); // Initial supply from factory
            expect(ethBalance).to.equal(ethers.parseEther("1"));
        });
    });

    describe("Buy Tokens", function () {
        it("Should allow buying tokens with ETH", async function () {
            const ethAmount = ethers.parseEther("1");
            const initialBalance = await token.balanceOf(user1.address);

            await liquidityPool.connect(user1).buyTokens({ value: ethAmount });

            const finalBalance = await token.balanceOf(user1.address);

            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should revert when no ETH is sent", async function () {
            await expect(
                liquidityPool.connect(user1).buyTokens({ value: 0 })
            ).to.be.revertedWith("No ETH sent");
        });

        it("Should revert when no liquidity", async function () {
            const newPool = await (await ethers.getContractFactory("LiquidityPool")).deploy(await token.getAddress());
            await newPool.waitForDeployment();

            await expect(
                newPool.connect(user1).buyTokens({ value: ethers.parseEther("1") })
            ).to.be.revertedWith("No liquidity");
        });
    });

    describe("Sell Tokens", function () {
        beforeEach(async function () {
            await liquidityPool.connect(user1).buyTokens({ value: ethers.parseEther("1") });
        });

        it("Should allow selling tokens for ETH", async function () {
            const initialBalance = await ethers.provider.getBalance(user1.address);

            // Get the token balance before selling
            const tokenBalance = await token.balanceOf(user1.address);
            expect(tokenBalance).to.be.gt(0);

            const tokenAmount = tokenBalance;

            // Approve the liquidity pool to spend tokens
            await token.connect(user1).approve(await liquidityPool.getAddress(), tokenAmount);

            // Verify the approval
            const allowance = await token.allowance(user1.address, await liquidityPool.getAddress());
            expect(allowance).to.equal(tokenAmount);

            // Sell tokens
            await liquidityPool.connect(user1).sellTokens(tokenAmount);

            // Verify the token balance decreased
            const finalTokenBalance = await token.balanceOf(user1.address);
            expect(finalTokenBalance).to.be.lt(tokenBalance);

            // Verify ETH balance increased
            const finalBalance = await ethers.provider.getBalance(user1.address);
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should revert when no tokens are sent", async function () {
            await expect(
                liquidityPool.connect(user1).sellTokens(0)
            ).to.be.revertedWith("No tokens sent");
        });

        it("Should revert when insufficient balance", async function () {
            const largeAmount = ethers.parseEther("1000000");
            await expect(
                liquidityPool.connect(user1).sellTokens(largeAmount)
            ).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Price Calculations", function () {
        beforeEach(async function () {
            // Add some ETH to the pool first
            await owner.sendTransaction({
                to: await liquidityPool.getAddress(),
                value: ethers.parseEther("1")
            });
        });

        it("Should calculate correct tokens out for ETH in", async function () {
            const ethIn = ethers.parseEther("0.1");
            const tokensOut = await liquidityPool.getTokensOut(ethIn);
            expect(tokensOut).to.be.gt(0);
        });

        it("Should calculate correct ETH out for tokens in", async function () {
            const tokensIn = ethers.parseEther("100");
            const ethOut = await liquidityPool.getEthOut(tokensIn);
            expect(ethOut).to.be.gt(0);
        });
    });
}); 