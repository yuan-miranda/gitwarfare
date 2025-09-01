function isMobileUserAgent() {
    return (
        (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768)
        && !localStorage.getItem('hideMobileSetupPrompt')
    );
}

function showMobileSetupPrompt() {
    if (isMobileUserAgent()) {
        document.querySelector('.overlay').style.display = 'flex';
    }
}

function eventListeners() {
    document.getElementById('mobileSetupConfirm').addEventListener('click', () => {
        console.log('Mobile setup confirmed');
        const checkbox = document.getElementById('mobileSetupClose');
        if (checkbox.checked) {
            localStorage.setItem('hideMobileSetupPrompt', 'true');
        }
        document.querySelector('.overlay').style.display = 'none';
    });
}


document.addEventListener("DOMContentLoaded", function () {
    showMobileSetupPrompt();
    eventListeners();
});
