import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    AuthorityType,
    createAssociatedTokenAccount,
    createMint,
    mintTo,
    NATIVE_MINT,
    setAuthority,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import BN from "bn.js";

import * as borsh from "borsh";
import { assert } from "chai";
import { Vestingroyale, IDL } from "../target/types/vestingroyale";
import { createLookupTable, findAta, findVestingRoyalePda, processVersionedTransaction, sleep } from "./utils";

const PROGRAM_ID = new PublicKey("2FG7tvMgxAYX3ZF1Zg1Cz36TSwyFrNvN5ipXJd9Yb8Ji");

describe("address lookup table", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    let vr = new anchor.Program<Vestingroyale>(IDL, PROGRAM_ID, provider);

    let payer = Keypair.generate()

    let alice = Keypair.generate();
    let bob = Keypair.generate();
    let charlie = Keypair.generate();

    let
        BOL: PublicKey,
        initBolAccount: PublicKey,
        aliceBolAccount: PublicKey,
        bobBolAccount: PublicKey,
        charlieBolAccount: PublicKey;

    it("create mint", async () => {
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                payer.publicKey,
                LAMPORTS_PER_SOL
            ),
            "confirmed"
        );

        BOL = await createMint(
            provider.connection,
            payer,
            payer.publicKey,
            payer.publicKey,
            6
        );

        initBolAccount = await createAssociatedTokenAccount(
            provider.connection,
            payer,
            BOL,
            payer.publicKey
        );

        aliceBolAccount = await createAssociatedTokenAccount(
            provider.connection,
            payer,
            BOL,
            alice.publicKey
        );

        bobBolAccount = await createAssociatedTokenAccount(
            provider.connection,
            payer,
            BOL,
            bob.publicKey
        );

        charlieBolAccount = await createAssociatedTokenAccount(
            provider.connection,
            payer,
            BOL,
            charlie.publicKey
        );

        mintTo(
            provider.connection,
            payer,
            BOL,
            initBolAccount,
            payer.publicKey,
            600 * 10 ** 6, // 600 easy to math with
        )
    });

    it("create a vesting royale", async function () {
        console.log(`CREATE VESTING ROYALE`);

        console.log(`payer: ${payer.publicKey}`);

        let vestingroyale = new PublicKey(await findVestingRoyalePda(payer.publicKey, BOL));

        console.log(`vr: ${vestingroyale}`);
        console.log(`bol: ${BOL}`);

        let pool = await findAta(
            vestingroyale,
            BOL,
        );
        console.log(`pool: ${pool}`);

        let knownAccounts = [
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
        ]

        let numAdditionalAccounts = 100

        let additionalAccounts = [...Array(numAdditionalAccounts).keys()].map(x => {
            return {
                isSigner: false,
                isWritable: false,
                pubkey: Keypair.generate().publicKey
            }
        })

        let allRemainingAccounts = [
            ...knownAccounts,
            ...additionalAccounts
        ]

        let lookupTableAddress = await createLookupTable(provider, allRemainingAccounts.map(x => x.pubkey))

        // wait for ALT to activate
        await sleep(1000)

        const lookupTableAccount = await provider.connection
            .getAddressLookupTable(lookupTableAddress)
            .then((res) => res.value);

        console.log(`lookup table has ${lookupTableAccount?.state.addresses.length} addresses`)

        let ix = await vr.methods.createVesting({
            startEpoch: null,
            endEpochDelta: new BN(10),
            initialVest: 5000,
            amount: new BN(600 * 10 ** 6),
            recipientCount: new BN(numAdditionalAccounts + 3)
        }).accounts({
            vestingRoyale: vestingroyale,
            initializer: payer.publicKey,
            initializerTokenAccount: initBolAccount,
            vestingPool: pool,
            mint: BOL,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }
        )
            .remainingAccounts(allRemainingAccounts)
            .instruction()

        let sig = await processVersionedTransaction(provider, [ix], [payer], lookupTableAccount)
        let latestBlockhash = await provider.connection.getLatestBlockhash()
        await provider.connection.confirmTransaction({ signature: sig, ...latestBlockhash });

        const a = await vr.account.vestingRoyale.fetch(vestingroyale);
        console.log(`bump ${a.bump}`);
        console.log(`startEpoch ${a.startEpoch}`);
        console.log(`endEpoch ${a.endEpoch}`);
        console.log(`initializer ${a.initializer}`);
        console.log(`initial Vest ${a.initialVest}`);
        console.log(`pool ${a.vestingPool}`);
        console.log(`recipients ${a.recipients}`);

        assert.equal(a.initializer.toBase58(), payer.publicKey.toBase58());
        assert.equal(a.initialVest, 5000);
        assert.equal(a.vestingPool.toBase58(), pool.toBase58());
        assert.equal(a.recipients[0].toBase58(), alice.publicKey.toBase58());
        assert.equal(a.recipients[1].toBase58(), bob.publicKey.toBase58());
        assert.equal(a.recipients[2].toBase58(), charlie.publicKey.toBase58());
        assert.equal(a.recipients.length, numAdditionalAccounts + 3);
    });
});