/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { io } from 'https://cdn.socket.io/4.5.4/socket.io.esm.min.js';

function showErrorModal(text) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text,
    });

    if (typeof umami !== 'undefined') {
        umami.track('error', { error: text });
    }
}

const socket = io({
    autoConnect: true,
});
let generatedInProgress = false;

socket.on('connect', () => console.log('socket connected'));
socket.on('disconnect', () => console.log('socket disconnected'));
socket.on('disconnect', () => {
    if (generatedInProgress) {
        showErrorModal('Connection to server lost, please try again');
    }
});

const showWorking = () =>
    Swal.fire({
        icon: 'info',
        title: 'Generating the app...',
        html: `
            <div>The process takes about two minutes.</div>
            <div><b>Do not close this page until the process is complete</b></div>
        `,
        didOpen: () => {
            Swal.showLoading();
        },
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
    });
const showDone = ({ domain, downloadUrl, appName, viewMode, blockMedia }) =>
    Swal.fire({
        icon: 'success',
        title: 'All Done!',
        html: `
            APK file created for website ${domain}<br>
            App name: ${appName}<br>
            View mode: ${viewMode}<br>
            Block media: ${blockMedia ? 'Yes' : 'No'}
        `,
        footer: `<a class="btn btn-block btn-primary" href="${downloadUrl}">Click here to download the generated APK file</a>`,
        showConfirmButton: false,
        allowOutsideClick: false,
        showCloseButton: true,
    });

$('input').on('focusout', function (e) {
    const input = $(this).val();
    if (input.length > 0) {
        $(this).addClass('active');
    } else {
        $(this).removeClass('active');
    }
});

function getImageBlob(imageElement) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        ctx.drawImage(imageElement, 0, 0);

        return canvas.toBlob((blob) => resolve(blob));
    });
}

$('#icon').on('change', async function (e) {
    if (typeof umami !== 'undefined') {
        umami.track('custom_icon_uploaded');
    }
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        const { isConfirmed } = await Swal.fire({
            title: 'Select the desired area',
            html: '<div id="crop-select"></div>',
            didOpen: () => {
                $('#crop-select').CropSelectJs();
                $('#crop-select').CropSelectJs('setSelectionAspectRatio', 1); // square
                reader.onload = function (e) {
                    $('#crop-select').CropSelectJs('setImageSrc', e.target.result);
                };
                reader.readAsDataURL(new Blob([file]));
            },
            confirmButtonText: 'Confirm',
        });
        if (isConfirmed) {
            const data = $('#crop-select').CropSelectJs('getImageSrc');
            const blob = await getImageBlob($(`<img src="${data}" />`)[0]);
            const container = new DataTransfer();
            container.items.add(new File([blob], blob.name, { type: blob.type }));
            this.files = container.files;
        } else {
            this.value = '';
        }
    }
});

let advancedOptionsClickTracked = false;
$('#advancedOptions').on('click', function (e) {
    $('#advancedOptionsContainer').slideToggle();
    $('#advancedOptions i').toggleClass('fa-chevron-down fa-chevron-up');

    if (!advancedOptionsClickTracked && typeof umami !== 'undefined') {
        umami.track('advanced_options_opened');
        advancedOptionsClickTracked = true;
    }
});

$('#useHomePage').on('change', function (e) {
    if (this.checked) {
        $('#customStartupUrlContainer').slideUp();
    } else {
        $('#customStartupUrlContainer').slideDown();
    }
});

$('form').on('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const url = form.url.value;
    const useHomePage = form.useHomePage.checked;
    let startUpUrl = '';

    if (!useHomePage) {
        startUpUrl = form.startUpUrl.value;
    }

    const additionalDomains = [form.additionalDomain1.value, form.additionalDomain2.value, form.additionalDomain3.value].filter((domain) => domain.trim() !== '');
    const blockMedia = form.forcePortrait.checked;
    const appName = form.name.value;
    const viewMode = form.viewMode.value;
    const icon = form.icon.files[0];
    const adsBlocker = form.adsBlocker.checked;
    const noSslMode = form.noSslMode.checked;

    const DOMAIN_REGEX = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;
    if (!DOMAIN_REGEX.test(url)) {
        return showErrorModal('The domain is not valid');
    }

    if (!useHomePage && startUpUrl.trim() === '') {
        return showErrorModal('Please enter the startup page URL');
    }

    for (const domain of additionalDomains) {
        if (!DOMAIN_REGEX.test(domain)) {
            return showErrorModal(`The additional domain "${domain}" is not valid`);
        }
    }

    showWorking();

    socket.emit('generate-apk', {
        url,
        additionalDomains,
        appName,
        blockMedia,
        viewMode,
        startUpUrl,
        icon,
        adsBlocker,
        noSslMode,
    });
    generatedInProgress = true;
});

socket.on('done', (data) => {
    generatedInProgress = false;
    showDone(data);
    if (typeof umami !== 'undefined') {
        umami.track('download_apk');
    }
    $('input[type=text],input[type=url]').val('').removeClass('active');
    $('input[type="checkbox"]').prop('checked', true);
    $('#customStartupUrlContainer').hide();
});

socket.on('error', (data) => {
    generatedInProgress = false;
    showErrorModal(data.message);
});
