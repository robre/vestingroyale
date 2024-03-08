# Vesting Royale
or: Battle Royale Token Vesting

## What is it?
Anyone can create a vesting pool with a bunch of recipients for the vest. For instance if you launch a new token, but don't want airdrop recipients to dump on day 1.

Vesting means: token gets unlocked over time. Example: 10 Day vest -> can withdraw 10% on day 1, 20% on day 2, 100% on day 10.

Here's the twist: The total vesting amount is shared amongst recipients, and once you take your allocation early, you forfeit your right to the rest of the tokens. They will be distributed to whoever stays in the pool.

Example:

- 1000 Token Vesting Pool
- 4 Recipients
- 10 epoch Vesting
- starting at 0%

If all recipients hold until the end, everyone can withdraw 250 Tokens each.

However if one recipient (r1) decides to withdraw after 2 epochs:
- taker r1 gets 20% of 1000/4=250 tokens, which is 50 tokens
- Pool now has 950 tokens for 3 recipients

Another recipient (r2) decides to withdraw after 5 epochs:
- taker r2 gets 50% of 950/3=316 tokens, which is 158 tokens
- Pool now has 792 tokens for 2 recipients

Last 2 recipients wait until end of vesting and withdraw in full.
Each of them gets 396 tokens

## How does it work?

Very simple. Two Instructions:
- CreateVesting: Create and configure a new vesting royale pool
- Take: Withdraw from a vesting royale pool. Your share gets calculated, but then you're deleted from the recipient list

