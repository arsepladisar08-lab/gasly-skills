(function (global) {
  'use strict';

  /*
   * MEDIA PLACEHOLDERS
   * Semua gambar/video di bawah adalah aset ilustrasi eksternal.
   * Bukan dokumentasi usaha DapurSaji.
   * Periksa lisensi dan ketentuan penggunaan ulang sebelum deployment.
   */

  var MEDIA_PLACEHOLDERS = Object.freeze({
    hero: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=85',
      alt: 'Foto ilustrasi hidangan makanan Indonesia',
      source: 'Unsplash',
      label: 'Foto ilustrasi',
      isPlaceholder: true
    },

    riceBox: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
      alt: 'Foto referensi hidangan sehat dengan aneka lauk',
      source: 'Unsplash',
      label: 'Foto referensi',
      isPlaceholder: true
    },

    catering: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
      alt: 'Foto referensi hidangan katering',
      source: 'Unsplash',
      label: 'Foto referensi',
      isPlaceholder: true
    },

    traditional: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1515003197210-e0cd7184f8b5?auto=format&fit=crop&w=900&q=80',
      alt: 'Foto ilustrasi sajian makanan',
      source: 'Unsplash',
      label: 'Foto referensi',
      isPlaceholder: true
    },

    ambient: {
      type: 'video',
      url: 'https://videos.pexels.com/video-files/4253316/4253316-hd_1920_1080_25fps.mp4',
      poster: 'https://images.pexels.com/photos/3184192/pexels-photo-3184192.jpeg?auto=compress&cs=tinysrgb&w=1400',
      alt: 'Visual ilustrasi suasana aktivitas persiapan makanan',
      source: 'Pexels Videos',
      label: 'Visual ilustrasi suasana dapur',
      isPlaceholder: true
    }
  });

  function svgFallback(label) {
    var safeLabel = String(label || 'Foto ilustrasi')
      .replace(/[<>&"']/g, '')
      .slice(0, 60);

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">' +
      '<rect width="1200" height="700" fill="#F3EFE6"/>' +
      '<circle cx="600" cy="290" r="85" fill="#DCEAE0"/>' +
      '<path d="M515 300 Q600 190 685 300 Q600 390 515 300" fill="#0F766E" opacity=".8"/>' +
      '<text x="600" y="460" text-anchor="middle" fill="#132A24" font-family="sans-serif" font-size="27">' +
      safeLabel +
      '</text>' +
      '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function applyImageFallback(image, label) {
    if (!image || image.dataset.fallbackApplied === 'true') return;

    image.dataset.fallbackApplied = 'true';
    image.src = svgFallback(label);
  }

  function shouldAutoplayVideo() {
    return !global.matchMedia ||
      !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function attachVideo(video, media) {
    if (!video || !media) return;

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.poster = media.poster;

    if (shouldAutoplayVideo()) {
      video.autoplay = true;
      video.src = media.url;
      var playback = video.play();

      if (playback && typeof playback.catch === 'function') {
        playback.catch(function () {
          video.autoplay = false;
        });
      }
    } else {
      video.autoplay = false;
      video.removeAttribute('autoplay');
      video.pause();
    }
  }

  global.GaslyMedia = Object.freeze({
    MEDIA_PLACEHOLDERS: MEDIA_PLACEHOLDERS,
    svgFallback: svgFallback,
    applyImageFallback: applyImageFallback,
    shouldAutoplayVideo: shouldAutoplayVideo,
    attachVideo: attachVideo
  });
})(window);