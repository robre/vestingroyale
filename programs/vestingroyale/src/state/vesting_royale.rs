use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::error::*;
use crate::id;

#[account]
pub struct VestingRoyale {
    /// Initializer of the VestingRoyale Schedule. Used for pda
    pub initializer: Pubkey,

    /// Bump
    pub bump: u8,

    /// Epoch at which vesting starts
    pub start_epoch: u64,
    
    /// Epoch at which vesting ends
    pub end_epoch: u64,

    /// How much BPS unlocks instantly with start of vesting
    pub initial_vest: u16,

    /// The vesting Pool ATA.
    pub vesting_pool: Pubkey,

    /// List of Recipients that are still enrolled
    pub recipients: Vec<Pubkey>,
}

impl VestingRoyale {
    fn current_unlocked_bps(&self) -> u64 {
        let now = Clock::get().unwrap().epoch;

        /// End
        if now >= self.end_epoch {
            return 10000;
        }

        if ( now < self.start_epoch ) {
            return 0;
        }

        if ( now == self.start_epoch ) {
            return self.initial_vest as u64;
        }

        /// Always safe and non-0, because end_epoch > start_epoch (created with saturating add)
        let steps = self.end_epoch - self.start_epoch;

        /// Always safe, because initial_vest is required to be <= 10000
        let allocatable = 10000 - self.initial_vest;

        /// Div Rounds Down. Steps never 0
        let alloc_per_step:u64 = allocatable as u64 / steps;

        /// safe because we already checked that now > start_epoch 
        let passed = now - self.start_epoch;

        /// epoch is about 3 days. 120 per year, so in 100 years, passed * alloc_per_step would
        /// never exceed u64
        let a: u64 = (self.initial_vest as u64) + passed * alloc_per_step;

        if a > 10000 {
            panic!()
        }
        a
    }

    pub fn take(&mut self, recipient: Pubkey, pool_amount: u64) -> Result<u64> {
        let length: u64 = self.recipients.len() as u64;
        let index = self.recipients.iter().position(|x| *x == recipient).unwrap();

        self.recipients.swap_remove(index);

        let allocation = u64::try_from(
            (u128::from(pool_amount) / u128::from(length)) * (u128::from(self.current_unlocked_bps()) / u128::from(10000 as u16))
        ).unwrap();

        Ok(allocation)

            // examples:
            // Pool: 1000, recipients: 10, start: 1000, Len: 10 epochs, 2 passed 
            // Means: Max 100 tokens for this recipient, they get 10% right away (10 tokens), and then
            // 2/10 of the remaining 90% thus 18, so in total 28 tokens
            // -> allocation = 1000/10 * (1000 + 2 * (9000/10)) / 10000
            //                 100     * (2800) / 10000
            //               = 28 Tokens
            // Tests:
            // Normal Case as Above
            // First epoch
            // Last Epoch
            // Last User Early
            // Lasst User at the end

    }
    pub fn size(recipients_length: usize) -> usize {
        8  + // anchor account discriminator
            32 + // initializer
            1  + // bump
            8  + // Start_epoch
            8  + // end_epoch
            2  + // Initial Vest
            4  + // recipient vector length
            recipients_length * 32 // pubkeys
    }

}
