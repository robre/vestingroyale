import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import path from "path";
import { Program } from "@coral-xyz/anchor";
import assert from "assert";

import { Vestingroyale } from "../target/types/vestingroyale";
const program = anchor.workspace.Vestingroyale as Program<Vestingroyale>;


export function getTestProgramId() {
  const programKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            "../target/deploy/vestingroyale-keypair.json"
          ),
          "utf-8"
        )
      )
    )
  );

  return programKeypair.publicKey;
}

export type Testers = {
  initializer: Keypair;
  recipientA: Keypair;
  recipientB: Keypair;
};

export async function generateFundedKeypair(connection: Connection) {
  const keypair = Keypair.generate();

  const tx = await connection.requestAirdrop(
    keypair.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx);

  return keypair;
}

export async function generateMultisigMembers(
  connection: Connection
): Promise<Testers> {
  const members = {
    initializer: Keypair.generate(),
    recipientA: Keypair.generate(),
    recipientB: Keypair.generate(),
  };

  // UNCOMMENT TO PRINT MEMBER PUBLIC KEYS
  // console.log("Members:");
  // for (const [name, keypair] of Object.entries(members)) {
  //   console.log(name, ":", keypair.publicKey.toBase58());
  // }

  // Airdrop 100 SOL to each member.
  await Promise.all(
    Object.values(members).map(async (member) => {
      const sig = await connection.requestAirdrop(
        member.publicKey,
        100 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    })
  );

  return members;
}

export function createLocalhostConnection() {
  return new Connection("http://127.0.0.1:8899", "confirmed");
}

export async function createVestingRoyale({
  connection,
  createKey = Keypair.generate(),
  members,
  start,
  delta,
  programId,
}: {
  createKey?: Keypair;
  members: Testers;
  start: number;
  delta: number;
  connection: Connection;
  programId: PublicKey;
}) {
  const creator = await generateFundedKeypair(connection);

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  const signature = await multisig.rpc.multisigCreate({
    connection,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    sendOptions: { skipPreflight: true },
    programId,
  });

  await connection.confirmTransaction(signature);

  return [multisigPda, multisigBump] as const;
}

export function createTestTransferInstruction(
  authority: PublicKey,
  recipient: PublicKey,
  amount = 1000000
) {
  return SystemProgram.transfer({
    fromPubkey: authority,
    lamports: amount,
    toPubkey: recipient,
  });
}

/** Returns true if the given unix epoch is within a couple of seconds of now. */
export function isCloseToNow(
  unixEpoch: number | bigint,
  timeWindow: number = 2000
) {
  const timestamp = Number(unixEpoch) * 1000;
  return Math.abs(timestamp - Date.now()) < timeWindow;
}

/** Returns an array of numbers from min to max (inclusive) with the given step. */
export function range(min: number, max: number, step: number = 1) {
  const result = [];
  for (let i = min; i <= max; i += step) {
    result.push(i);
  }
  return result;
}

export function comparePubkeys(a: PublicKey, b: PublicKey) {
  return a.toBuffer().compare(b.toBuffer());
}

