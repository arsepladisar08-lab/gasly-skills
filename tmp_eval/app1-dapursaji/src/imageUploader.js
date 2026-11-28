(function (global) {
  'use strict';

  var ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_BYTES = 1024 * 1024;
  var MAX_DIMENSION = 1600;

  function driveImageUrl(fileId, width) {
    if (!fileId) return '';
    var size = Math.max(64, Math.min(2400, Number(width) || 800));
    return 'https://drive.google.com/thumbnail?id=' +
      encodeURIComponent(fileId) + '&sz=w' + size;
  }

  function driveImageFallbackUrl(fileId, width) {
    if (!fileId) return '';
    var size = Math.max(64, Math.min(2400, Number(width) || 800));
    return 'https://lh3.googleusercontent.com/d/' +
      encodeURIComponent(fileId) + '=w' + size;
  }

  function handleDriveImageError(element, fileId, width) {
    if (!element || element.dataset.fallbackApplied === 'true') return;
    element.dataset.fallbackApplied = 'true';
    element.src = driveImageFallbackUrl(fileId, width);
  }

  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || ALLOWED_MIMES.indexOf(file.type) === -1) {
        reject(new Error('Pilih gambar JPEG, PNG, atau WebP.'));
        return;
      }

      if (!file.size || file.size > 15 * 1024 * 1024) {
        reject(new Error('Ukuran gambar asli maksimal 15 MB sebelum kompresi.'));
        return;
      }

      var objectUrl = URL.createObjectURL(file);
      var image = new Image();

      image.onload = function () {
        URL.revokeObjectURL(objectUrl);

        var width = image.naturalWidth;
        var height = image.naturalHeight;

        if (!width || !height) {
          reject(new Error('Dimensi gambar tidak valid.'));
          return;
        }

        var ratio = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        var context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Browser tidak dapat memproses gambar.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        var outputMime = file.type === 'image/png' ? 'image/webp' : file.type;
        var quality = [0.84, 0.72, 0.60, 0.48, 0.36];
        var result = null;

        for (var i = 0; i < quality.length; i += 1) {
          var dataUrl = canvas.toDataURL(outputMime, quality[i]);
          var base64 = dataUrl.split(',')[1] || '';
          var bytes = Math.floor(base64.length * 3 / 4);

          result = {
            fileName: String(file.name || 'bukti-transfer')
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .slice(0, 100),
            mimeType: outputMime,
            base64: base64,
            sizeBytes: bytes
          };

          if (bytes <= MAX_BYTES) break;
        }

        if (!result || result.sizeBytes > MAX_BYTES) {
          reject(new Error('Gambar masih lebih dari 1 MB. Gunakan gambar yang lebih kecil.'));
          return;
        }

        resolve(result);
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Gagal membaca gambar.'));
      };

      image.src = objectUrl;
    });
  }

  function requestId() {
    return global.GaslyClient.uuid();
  }

  async function uploadPhoto(options) {
    var opts = options || {};
    var file = opts.file;
    var orderId = opts.orderId;
    var trackingToken = opts.trackingToken;
    var uploadNonce = opts.uploadNonce;

    function state(name, message) {
      if (typeof opts.onStateChange === 'function') {
        opts.onStateChange(name, message);
      }
    }

    if (!file || !orderId || !trackingToken || !uploadNonce) {
      var invalid = global.GaslyClient.failure(
        'Data pesanan, token pelacakan, atau uploadNonce tidak tersedia.',
        'VALIDATION_ERROR'
      );
      state('error', invalid.message);
      return invalid;
    }

    try {
      state('compressing', 'Mengoptimalkan foto bukti transfer...');

      var compressed = await compressImageFile(file);

      var ticketRequestId = requestId();

      state('uploading', 'Meminta tiket unggahan yang terikat pada pesanan...');

      var ticketRes = await global.GaslyClient.request('file.ticket', {
        order_id: orderId,
        tracking_token: trackingToken,
        file_name: compressed.fileName,
        mime_type: compressed.mimeType,
        size_bytes: compressed.sizeBytes,
        request_id: ticketRequestId,
        uploadNonce: uploadNonce
      }, {
        idempotent: true
      });

      if (
        ticketRes.status !== 'success' ||
        ticketRes.code !== 'OK' ||
        !ticketRes.data ||
        !ticketRes.data.ticket
      ) {
        state('error', ticketRes.message || 'Tiket unggahan gagal dibuat.');
        return ticketRes;
      }

      var ticket = ticketRes.data.ticket;

      var nonceFromTicket =
        ticketRes.data.upload_nonce ||
        ticketRes.data.uploadNonce ||
        uploadNonce;

      state('uploading', 'Mengirim bukti transfer ke penyimpanan privat...');

      var uploadRes = await global.GaslyClient.request('file.upload', {
        ticket: ticket,
        upload_nonce: nonceFromTicket,
        file_base64: compressed.base64,
        mime_type: compressed.mimeType
      }, {
        idempotent: true
      });

      if (uploadRes.status === 'success' && uploadRes.code === 'OK') {
        state('done', 'Bukti transfer berhasil diterima.');
        return uploadRes;
      }

      state('error', uploadRes.message || 'Unggahan tidak berhasil diverifikasi.');
      return uploadRes;
    } catch (error) {
      var result = global.GaslyClient.failure(
        error.message || 'Terjadi kesalahan saat mengunggah.',
        'INTERNAL_ERROR'
      );
      state('error', result.message);
      return result;
    }
  }

  global.GaslyImage = Object.freeze({
    driveImageUrl: driveImageUrl,
    driveImageFallbackUrl: driveImageFallbackUrl,
    handleDriveImageError: handleDriveImageError,
    compressImageFile: compressImageFile,
    uploadPhoto: uploadPhoto,
    MAX_BYTES: MAX_BYTES
  });
})(window);