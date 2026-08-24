// Konfigurasi Google Apps Script (GAS) Web App - SISARNA SMAN 2 Ciamis
window.gasConfig = {
    // Masukkan URL Web App GAS hasil deployment dari Google Apps Script di bawah ini:
    webAppUrl: "https://script.google.com/macros/s/AKfycbwpw03py5Cqo1dZBHNXnTIhXY9Qxgnxxrzr2Ht2SlLFiBta_L3AYUhlQCQAZOs1AZ73mg/exec",
    
    // Mengecek apakah URL GAS sudah dikonfigurasi dengan benar
    isConfigured: function() {
        return Boolean(this.webAppUrl && typeof this.webAppUrl === 'string' && this.webAppUrl.trim().startsWith('http'));
    }
};
