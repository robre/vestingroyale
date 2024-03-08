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
      600 * 10 ** 6, // 600 easy to math with
    )
  });

  beforeEach(async function () {
    await fastForward(context, 1n)
  });

  describe("#create_vr", async function () {
    it("create a vesting royale", async function () {

      console.log(`ok: ${payer.publicKey}`);

      let vestingroyale = new PublicKey(await findVestingRoyalePda(payer.publicKey));

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
            recipientCount: new BN(3)
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

      console.log(`ok`);
      console.log(`${ixh}`);

      //await ixh.bankrun(banksClient);

      const a = await vr.account.vestingRoyale.fetch(vestingroyale);
      console.log(`${a}`);

      // assert.equal(permissionlessAmmAcc.baseMint.toBase58(), META.toBase58());
      // assert.equal(permissionlessAmmAcc.quoteMint.toBase58(), USDC.toBase58());
      // assert.equal(permissionlessAmmAcc.baseMintDecimals, 9);
      // assert.equal(permissionlessAmmAcc.quoteMintDecimals, 6);
      // assert.equal(permissionlessAmmAcc.swapFeeBps, 1);
      // assert.equal(permissionlessAmmAcc.permissionedCaller.toBase58(), PublicKey.default.toBase58());
    });
  });
});
