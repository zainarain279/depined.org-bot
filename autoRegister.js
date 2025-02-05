import { saveToFile, delay, readFile } from './utils/helper.js';
import log from './utils/logger.js'
import Mailjs from '@cemalgnlts/mailjs';
import banner from './utils/banner.js';

import {
    registerUser,
    createUserProfile,
    confirmUserReff,
    getUserRef
} from './utils/api.js'
const mailjs = new Mailjs();

const main = async () => {
    log.info(banner);
    log.info(`proccesing run auto register (CTRL + C to exit)`);
    await delay(3);
    const tokens = await readFile("tokens.txt")
    for (let i = 0; i < 5; i++) {
        for (const token of tokens) {
            const response = await getUserRef(token);
            if (!response?.data?.is_referral_active) continue;
            const reffCode = response?.data?.referral_code;
            if (reffCode) {
                log.info(`Found new active referral code:`, reffCode);
                try {
                    let account = await mailjs.createOneAccount();
                    while (!account?.data?.username) {
                        log.warn('Failed To Generate New Email, Retrying...');
                        await delay(3)
                        account = await mailjs.createOneAccount();
                    }

                    const email = account.data.username;
                    const password = account.data.password;

                    log.info(`Trying to register email: ${email}`);
                    let regResponse = await registerUser(email, password, null);
                    while (!regResponse?.data?.token) {
                        log.warn('Failed To Register, Retrying...');
                        await delay(3)
                        regResponse = await registerUser(email, password, null);
                    }
                    const token = regResponse.data.token;

                    log.info(`Trying to create profile for ${email}`);
                    await createUserProfile(token, { step: 'username', username: email });
                    await createUserProfile(token, { step: 'description', description: "AI Startup" });


                    let confirm = await confirmUserReff(token, reffCode);
                    while (!confirm?.data?.token) {
                        log.warn('Failed To Confirm Referral, Retrying...');
                        await delay(3)
                        confirm = await confirmUserReff(token, reffCode);
                    }

                    await saveToFile("accounts.txt", `${email}|${password}`)
                    await saveToFile("tokens.txt", `${confirm.data.token}`)

                } catch (err) {
                    log.error('Error creating account:', err.message);
                }
            } else {
                log.warn('No referral code found for this account');
            }
        };
    }
};

// Handle CTRL+C (SIGINT)
process.on('SIGINT', () => {
    log.warn('SIGINT received. Exiting...');
    process.exit();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err);
    process.exit(1);
});

main();
