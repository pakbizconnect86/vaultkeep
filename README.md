# Vaultkeep 🔒

Apna khud ka encrypted password vault — Chrome/Edge extension jo kisi bhi site pe login karte hi password automatically save kar leta hai.

## Features
- Master password se poori vault lock/unlock hoti hai
- AES-256-GCM encryption (PBKDF2 key derivation, 150,000 iterations) — koi plain-text password disk pe store nahi hota
- Kisi bhi site pe login form submit karo → automatically detect + save
- Vault locked ho to pending queue me rakhta hai, unlock karne pe confirm kar k save karo
- Password generator, show/hide, copy to clipboard
- Sab kuch local rehta hai — koi server, koi tracking nahi

## Install (Developer Mode)

Ye extension Chrome Web Store pe published nahi hai, isliye manually load karna hoga:

1. Ye repo download/clone karo:
   ```
   git clone https://github.com/YOUR_USERNAME/vaultkeep.git
   ```
2. Chrome/Edge me `chrome://extensions` kholo
3. Top-right corner me **Developer mode** ON karo
4. **Load unpacked** pe click karo
5. `vaultkeep` folder select karo
6. Extension icon pin karo, click karo, aur apna master password set karo

## Kaise kaam karta hai

Jab bhi tum kisi site pe login form submit karte ho:
- Vault **unlocked** ho → password turant encrypt ho kar save ho jata hai (toast notification dikhega)
- Vault **locked** ho → capture pending queue me chala jata hai, extension icon pe badge count dikhega. Popup khol kar unlock karo, phir "Save" dabao us login ko vault me daalne ke liye

## Privacy

- Sab data sirf tumhare browser me (`chrome.storage.local`) rehta hai, encrypted form me
- Master password kabhi kahin save/transmit nahi hota — sirf current browser session me temporarily hold hota hai (`chrome.storage.session`), taake auto-capture kaam kar sake
- Koi external server, API, ya analytics nahi

## Disclaimer

Ye ek personal-use tool hai, kisi security audit se guzra nahi hai. Apni zimmedari par use karo — critical/financial accounts ke liye ek established password manager (Bitwarden, 1Password) zyada bharosemand hoga.

## License

MIT
