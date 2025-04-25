// Frontend encryption utilities
export const CRYPTO_KEY = "7f9K2b$pQ!4z@1Yd"; 

export function encryptData(data) {
    // Convert data to JSON string
    const jsonStr = JSON.stringify(data);
    
    // Generate random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Import key
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(CRYPTO_KEY),
        { name: 'AES-CBC' },
        false,
        ['encrypt']
    ).then(key => {
        // Encrypt the data
        return crypto.subtle.encrypt(
            {
                name: 'AES-CBC',
                iv: iv
            },
            key,
            new TextEncoder().encode(jsonStr)
        ).then(encrypted => {
            // Combine IV + encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // Return as base64 for transmission
            return btoa(String.fromCharCode(...combined));
        });
    });
}