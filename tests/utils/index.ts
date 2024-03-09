import { Clock, ProgramTestContext } from "solana-bankrun";
import { web3 } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
const PROGRAM_ID = new web3.PublicKey("2FG7tvMgxAYX3ZF1Zg1Cz36TSwyFrNvN5ipXJd9Yb8Ji");
const TOKEN_PROGRAM_ID = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const fastForward = async (context: ProgramTestContext, epochs: bigint) => {
    const currentClock = await context.banksClient.getClock();
    context.setClock(
        new Clock(
            currentClock.slot,
            currentClock.epochStartTimestamp,
            currentClock.epoch + epochs,
            currentClock.leaderScheduleEpoch,
            50n,
        ),
    );
}

export const findVestingRoyalePda = async (initializer: web3.PublicKey, mint: web3.PublicKey) => {
    const [publicKey] = web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("vestingroyale"),
            initializer.toBuffer(),
            mint.toBuffer(),
        ],
        PROGRAM_ID
    );
    return publicKey;
}

export const findAta = async (owner: web3.PublicKey, mint: web3.PublicKey) => {
    const [publicKey] = web3.PublicKey.findProgramAddressSync(
        [
            owner.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return publicKey;
}

export const createLookupTable = async (provider: anchor.AnchorProvider, pubkeys: web3.PublicKey[]): Promise<web3.PublicKey> => {
    const slot = await provider.connection.getSlot();
    let latestBlockhash = await provider.connection.getLatestBlockhash()

    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: provider.wallet.publicKey,
            payer: provider.wallet.publicKey,
            recentSlot: slot,
        });

    const messageLegacy = new web3.TransactionMessage({
        payerKey: provider.wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [lookupTableInst],
    }).compileToLegacyMessage();

    let transaction = new web3.VersionedTransaction(messageLegacy)
    transaction = await provider.wallet.signTransaction(transaction)

    let signature = await provider.connection.sendTransaction(transaction, { skipPreflight: true });
    await provider.connection.confirmTransaction({ signature, ...latestBlockhash });

    for (let pubkey of pubkeys) {
        const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
            payer: provider.wallet.publicKey,
            authority: provider.wallet.publicKey,
            lookupTable: lookupTableAddress,
            addresses: [pubkey],
        });

        const messageLegacy = new web3.TransactionMessage({
            payerKey: provider.wallet.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [extendInstruction],
        }).compileToLegacyMessage();

        let transaction = new web3.VersionedTransaction(messageLegacy)
        transaction = await provider.wallet.signTransaction(transaction)

        let signature = await provider.connection.sendTransaction(transaction, { skipPreflight: true });
        await provider.connection.confirmTransaction({ signature, ...latestBlockhash });
    }

    return lookupTableAddress
}

export const processVersionedTransaction = async (provider: anchor.AnchorProvider, ixs: web3.TransactionInstruction[], signers: web3.Signer[], alt: web3.AddressLookupTableAccount) => {
    let latestBlockhash = await provider.connection.getLatestBlockhash()

    const message = new web3.TransactionMessage({
        payerKey: provider.wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: ixs,
    }).compileToV0Message([alt]);

    // Create a new VersionedTransaction which supports legacy and v0
    let tx = new web3.VersionedTransaction(message)
    tx = await provider.wallet.signTransaction(tx)
    for (let signer of signers) {
        const w = new anchor.Wallet(web3.Keypair.fromSecretKey(signer.secretKey));
        tx = await w.signTransaction(tx)
    }

    return provider.connection.sendTransaction(tx)
}

export async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}