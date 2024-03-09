import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3} from "@coral-xyz/anchor";

import { BankrunProvider } from "anchor-bankrun";

import {
  startAnchor,
  Clock,
  ProgramTestContext,
  BanksClient
} from "solana-bankrun";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  
} from "spl-token-bankrun";

const { PublicKey, Keypair } = web3;

import { assert } from "chai";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { fastForward, findVestingRoyalePda, findAta } from "./utils";

import { Vestingroyale, IDL } from "../target/types/vestingroyale";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

const PROGRAM_ID = new PublicKey("2FG7tvMgxAYX3ZF1Zg1Cz36TSwyFrNvN5ipXJd9Yb8Ji");

describe("vestingroyale", () => {
  let provider: BankrunProvider,
    payer: web3.Keypair,
    bob: web3.Keypair,
    alice: web3.Keypair,
    charlie: web3.Keypair,
    context: ProgramTestContext,
    banksClient: BanksClient,
    BOL: web3.PublicKey,
    initBolAccount: web3.PublicKey,
    aliceBolAccount: web3.PublicKey,
    bobBolAccount: web3.PublicKey,
    charlieBolAccount: web3.PublicKey,
    vr: Program<Vestingroyale>;

  before(async function () {
    context = await startAnchor(
      "./",
      [],
      []
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    //ammClient = await AmmClient.createClient({ provider })
    //const program = anchor.workspace.Vestingroyale as Program<Vestingroyale>;
    vr = new Program<Vestingroyale>(IDL, PROGRAM_ID, provider);
    payer = provider.wallet.payer;

    alice = Keypair.generate();
    bob = Keypair.generate();
    charlie = Keypair.generate();

    BOL = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    initBolAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      BOL,
      payer.publicKey
    );

    aliceBolAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      BOL,
      alice.publicKey
    );

    bobBolAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      BOL,
      bob.publicKey
    );

    charlieBolAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      BOL,
      charlie.publicKey
    );

    mintTo(
      banksClient,
      payer,
      BOL,
      initBolAccount,
      payer.publicKey,
      2 * 600 * 10 ** 6, // 600 easy to math with
    )
  });


  describe("#create_vr", async function () {
    it("create a vesting royale", async function () {
      console.log(`CREATE VESTING ROYALE`);

      console.log(`payer: ${payer.publicKey}`);

      await fastForward(context, 1n);
      let nonce = new BN(1234123);
      console.log(`${nonce.toBuffer('le', 8)}`);
      let vestingroyale = new PublicKey(await findVestingRoyalePda(payer.publicKey, nonce));

      console.log(`vr: ${vestingroyale}`);
      console.log(`bol: ${BOL}`);

      let pool = await findAta(
          vestingroyale,
          BOL,
        );
      console.log(`pool: ${pool}`);

      let ixh = await vr.methods.createVesting({
            startEpoch: null,
            endEpochDelta: new BN(10),
            initialVest: 5000,
            amount: new BN(600 * 10**6),
            recipientCount: new BN(3),
            nonce: nonce
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            initializerTokenAccount: initBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,}
        ).remainingAccounts([
            {
                isSigner: false,
                isWritable: false,
                pubkey: alice.publicKey
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: bob.publicKey
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: charlie.publicKey
            },
        ]).signers([payer]).rpc();

      console.log(`created Vesting`);
      console.log(`${ixh}`);

      const a = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`bump ${a.bump}`);
      console.log(`startEpoch ${a.startEpoch}`);
      console.log(`endEpoch ${a.endEpoch}`);
      console.log(`initializer ${a.initializer}`);
      console.log(`initial Vest ${a.initialVest}`);
      console.log(`pool ${a.vestingPool}`);
      console.log(`recipients ${a.recipients}`);
      const vp = await getAccount(banksClient, a.vestingPool);
      console.log(`Pool contains ${vp.amount } tokens`);

      assert.equal(a.startEpoch.toNumber(), 1);
      assert.equal(a.endEpoch.toNumber(), 11);
      assert.equal(a.initializer.toBase58(), payer.publicKey.toBase58());
      assert.equal(a.initialVest, 5000);
      assert.equal(a.vestingPool.toBase58(), pool.toBase58());
      assert.equal(a.recipients[0].toBase58(), alice.publicKey.toBase58());
      assert.equal(a.recipients[1].toBase58(), bob.publicKey.toBase58());
      assert.equal(a.recipients[2].toBase58(), charlie.publicKey.toBase58());
      assert.equal(600_000_000n, vp.amount);

      console.log(`ALICE WITHDRAWS AFTER 1 EPOCH`);
      // Test: Alice Withdraws after 1 Epoch in Epoch 2.
      // should receive 55% of her 200 token allocation
      // That's 110 tokens. Thus 490 tokens to stay in the pool
      // 
      await fastForward(context, 1n);

      let take = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: alice.publicKey,
            takerTokenAccount: aliceBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([alice]).rpc();
      let b = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`bump ${b.bump}`);
      console.log(`startEpoch ${b.startEpoch}`);
      console.log(`endEpoch ${b.endEpoch}`);
      console.log(`initializer ${b.initializer}`);
      console.log(`initial Vest ${b.initialVest}`);
      console.log(`pool ${b.vestingPool}`);
      console.log(`recipients ${b.recipients}`);
      let vp2 = await getAccount(banksClient, b.vestingPool);
      console.log(`Pool contains ${vp2.amount } tokens`);

      assert.equal(b.recipients[1].toBase58(), bob.publicKey.toBase58());
      assert.equal(b.recipients[0].toBase58(), charlie.publicKey.toBase58());
      assert.equal(490_000_000n, vp2.amount);

      console.log(`BOB WITHDRAWS AFTER 4 MORE EPOCHS`);
      // Test: Bob Withdraws after 4 More Epoch in Epoch 6.
      // should receive 75% of his 245 token allocation
      // That's 183.75 tokens. Thus 490 tokens to stay in the pool
      // 
      await fastForward(context, 4n);

      let take2 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: bob.publicKey,
            takerTokenAccount: bobBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([bob]).rpc();
      let c = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${c.recipients}`);
      let vp3 = await getAccount(banksClient, c.vestingPool);
      console.log(`Pool contains ${vp3.amount } tokens`);

      assert.equal(c.recipients[0].toBase58(), charlie.publicKey.toBase58());
      assert.equal(306_250_000n, vp3.amount);

      console.log(`Charlie WITHDRAWS AFTER 4 MORE EPOCHS`);
      // Test: Charlie Withdraws after 4 More Epoch in Epoch 10.
      // should receive 95% of his 306.25 token allocation
      // That's 290.9375 tokens. Thus 15.3125 tokens to stay in the pool
      // 
      await fastForward(context, 4n);

      let take3 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: charlie.publicKey,
            takerTokenAccount: charlieBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([charlie]).rpc();
      let d = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${d.recipients}`);
      let vp4 = await getAccount(banksClient, d.vestingPool);
      console.log(`Pool contains ${vp4.amount } tokens`);

      assert.equal(15_312_500n, vp4.amount);

      console.log(`Initializer Reclaims contents AFTER 4 MORE EPOCHS`);
      // Test: Charlie Withdraws after 4 More Epoch in Epoch 10.
      // should receive 95% of his 306.25 token allocation
      // That's 290.9375 tokens. Thus 15.3125 tokens to stay in the pool
      // 
      await fastForward(context, 4n);

      let take4 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: payer.publicKey,
            takerTokenAccount: initBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([payer]).rpc();
      let e = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${e.recipients}`);
      let vp5 = await getAccount(banksClient, e.vestingPool);
      console.log(`Pool contains ${vp5.amount } tokens`);
      assert.equal(0n, vp5.amount);

      let initer = await getAccount(banksClient, initBolAccount);
      console.log(`Initializer has ${initer.amount } tokens`);

    });
  });

  describe("#create_vr_long", async function () {
    it("create a vesting royale", async function () {
      console.log(`CREATE VESTING ROYALE`);

      console.log(`payer: ${payer.publicKey}`);

      await fastForward(context, 1n);
      let nonce = new BN(1234125);
      console.log(`${nonce.toBuffer('le', 8)}`);
      let vestingroyale = new PublicKey(await findVestingRoyalePda(payer.publicKey, nonce));

      console.log(`vr: ${vestingroyale}`);
      console.log(`bol: ${BOL}`);

      let pool = await findAta(
          vestingroyale,
          BOL,
        );
      console.log(`pool: ${pool}`);

      let ixh = await vr.methods.createVesting({
            startEpoch: null,
            endEpochDelta: new BN(113),
            initialVest: 0,
            amount: new BN(600 * 10**6),
            recipientCount: new BN(3),
            nonce: nonce
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            initializerTokenAccount: initBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,}
        ).remainingAccounts([
            {
                isSigner: false,
                isWritable: false,
                pubkey: alice.publicKey
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: bob.publicKey
            },
            {
                isSigner: false,
                isWritable: false,
                pubkey: charlie.publicKey
            },
        ]).signers([payer]).rpc();

      console.log(`created Vesting`);
      console.log(`${ixh}`);

      const a = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`bump ${a.bump}`);
      console.log(`startEpoch ${a.startEpoch}`);
      console.log(`endEpoch ${a.endEpoch}`);
      console.log(`initializer ${a.initializer}`);
      console.log(`initial Vest ${a.initialVest}`);
      console.log(`pool ${a.vestingPool}`);
      console.log(`recipients ${a.recipients}`);
      const vp = await getAccount(banksClient, a.vestingPool);
      console.log(`Pool contains ${vp.amount } tokens`);

      assert.equal(a.startEpoch.toNumber(), 15);
      assert.equal(a.endEpoch.toNumber(), 128);
      assert.equal(a.initializer.toBase58(), payer.publicKey.toBase58());
      assert.equal(a.initialVest, 0);
      assert.equal(a.vestingPool.toBase58(), pool.toBase58());
      assert.equal(a.recipients[0].toBase58(), alice.publicKey.toBase58());
      assert.equal(a.recipients[1].toBase58(), bob.publicKey.toBase58());
      assert.equal(a.recipients[2].toBase58(), charlie.publicKey.toBase58());
      assert.equal(600_000_000n, vp.amount);

      console.log(`ALICE WITHDRAWS AFTER 1 EPOCH`);
      // Test: Alice Withdraws after 1 Epoch in Epoch 2.
      // should receive 55% of her 200 token allocation
      // That's 110 tokens. Thus 490 tokens to stay in the pool
      // 
      await fastForward(context, 1n);

      let take = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: alice.publicKey,
            takerTokenAccount: aliceBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([alice]).rpc();
      let b = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`bump ${b.bump}`);
      console.log(`startEpoch ${b.startEpoch}`);
      console.log(`endEpoch ${b.endEpoch}`);
      console.log(`initializer ${b.initializer}`);
      console.log(`initial Vest ${b.initialVest}`);
      console.log(`pool ${b.vestingPool}`);
      console.log(`recipients ${b.recipients}`);
      let vp2 = await getAccount(banksClient, b.vestingPool);
      console.log(`Pool contains ${vp2.amount } tokens`);

      assert.equal(b.recipients[1].toBase58(), bob.publicKey.toBase58());
      assert.equal(b.recipients[0].toBase58(), charlie.publicKey.toBase58());
      assert.equal(598_230_100n, vp2.amount);

      console.log(`BOB WITHDRAWS AFTER 80 MORE EPOCHS`);
      // Test: Bob Withdraws after 4 More Epoch in Epoch 6.
      // should receive 75% of his 245 token allocation
      // That's 183.75 tokens. Thus 490 tokens to stay in the pool
      // 
      await fastForward(context, 80n);

      let take2 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: bob.publicKey,
            takerTokenAccount: bobBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([bob]).rpc();
      let c = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${c.recipients}`);
      let vp3 = await getAccount(banksClient, c.vestingPool);
      console.log(`Pool contains ${vp3.amount } tokens`);

      assert.equal(c.recipients[0].toBase58(), charlie.publicKey.toBase58());
      assert.equal(383821591n, vp3.amount);

      console.log(`Charlie WITHDRAWS AFTER 4 MORE EPOCHS`);
      // Test: Charlie Withdraws after 4 More Epoch in Epoch 10.
      // should receive 95% of his 306.25 token allocation
      // That's 290.9375 tokens. Thus 15.3125 tokens to stay in the pool
      // 
      await fastForward(context, 4n);

      let take3 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: charlie.publicKey,
            takerTokenAccount: charlieBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([charlie]).rpc();
      let d = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${d.recipients}`);
      let vp4 = await getAccount(banksClient, d.vestingPool);
      console.log(`Pool contains ${vp4.amount } tokens`);

      assert.equal(95108112n, vp4.amount);

      console.log(`Initializer Reclaims contents AFTER 20 MORE EPOCHS`);
      // Test: Charlie Withdraws after 4 More Epoch in Epoch 10.
      // should receive 95% of his 306.25 token allocation
      // That's 290.9375 tokens. Thus 15.3125 tokens to stay in the pool
      // 
      await fastForward(context, 4n);

      let take4 = await vr.methods.take({
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            taker: payer.publicKey,
            takerTokenAccount: initBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }).signers([payer]).rpc();
      let e = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`recipients ${e.recipients}`);
      let vp5 = await getAccount(banksClient, e.vestingPool);
      console.log(`Pool contains ${vp5.amount } tokens`);
      assert.equal(0n, vp5.amount);

      let initer = await getAccount(banksClient, initBolAccount);
      console.log(`Initializer has ${initer.amount } tokens`);

    });
  });
});
