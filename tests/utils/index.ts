import { Clock, ProgramTestContext } from "solana-bankrun";
import { web3, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
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

export const findVestingRoyalePda = async (initializer: web3.PublicKey, nonce: BN) => {
    const [publicKey] = web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("vestingroyale"),
            initializer.toBuffer(),
            nonce.toBuffer('le', 8),
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
