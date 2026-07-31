/**
 * WhatsApp Service using whatsapp-web.js
 * 
 * Manages a single WhatsApp Web client instance for sending
 * automated messages (monthly analytics reports) to store owners.
 * 
 * On first run, a QR code is printed to the terminal for authentication.
 * After that, the session is persisted via LocalAuth so re-scans are not needed.
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

let client = null;
let isReady = false;

/**
 * Initialize the WhatsApp Web client.
 * Call once at server startup.
 */
export function initWhatsApp() {
    if (client) {
        console.log('[WhatsApp] Client already initialized.');
        return client;
    }

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'   // persisted session folder
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('\n[WhatsApp] Scan this QR code with WhatsApp to authenticate:\n');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        isReady = true;
        console.log('[WhatsApp] Client is ready and authenticated!');
    });

    client.on('authenticated', () => {
        console.log('[WhatsApp] Session authenticated successfully.');
    });

    client.on('auth_failure', (msg) => {
        isReady = false;
        console.error('[WhatsApp] Authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        isReady = false;
        console.log('[WhatsApp] Client disconnected:', reason);
        // Attempt to reconnect after a delay
        setTimeout(() => {
            console.log('[WhatsApp] Attempting reconnect...');
            client.initialize().catch(err => {
                console.error('[WhatsApp] Reconnect failed:', err.message);
            });
        }, 30000);
    });

    client.initialize().catch(err => {
        console.error('[WhatsApp] Initialization failed:', err.message);
    });

    return client;
}

/**
 * Send a WhatsApp message to a phone number.
 * @param {string} phoneNumber  – Indian phone number (10 digits, or with 91 prefix)
 * @param {string} message      – Text message body
 * @returns {Promise<boolean>}  – true if sent, false otherwise
 */
export async function sendWhatsAppMessage(phoneNumber, message) {
    if (!client || !isReady) {
        console.warn('[WhatsApp] Client not ready. Message NOT sent to', phoneNumber);
        return false;
    }

    try {
        // Normalize Indian phone number → 91XXXXXXXXXX@c.us
        let cleaned = String(phoneNumber).replace(/[\s\-\+\(\)]/g, '');
        // Remove leading zero (e.g. 08101402916 → 8101402916)
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.slice(1);
        }
        // Add country code if 10-digit number
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        const chatId = cleaned + '@c.us';

        // Verify the number is registered on WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`[WhatsApp] ${phoneNumber} is NOT registered on WhatsApp. Skipping.`);
            return false;
        }

        await client.sendMessage(chatId, message);
        console.log(`[WhatsApp] Message sent to ${phoneNumber}`);
        return true;
    } catch (err) {
        console.error(`[WhatsApp] Failed to send message to ${phoneNumber}:`, err.message);
        return false;
    }
}

/**
 * Check if the WhatsApp client is ready.
 */
export function isWhatsAppReady() {
    return isReady;
}
