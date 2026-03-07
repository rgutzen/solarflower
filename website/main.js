// SPDX-FileCopyrightText: 2025 Robin Gutzen <robin.gutzen@outlook.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Solarflower — Landing page interactions
 *
 * 1. Sticky nav scroll state
 * 2. Intersection Observer for reveal-on-scroll
 * 3. Smooth scroll for anchor links
 */

(function () {
  "use strict";

  // -------------------------------------------------------------------
  // 1. Nav: add .nav--scrolled when page is scrolled past threshold
  // -------------------------------------------------------------------
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("nav--scrolled", window.scrollY > 16);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check
  }

  // -------------------------------------------------------------------
  // 2. Reveal elements on scroll using IntersectionObserver
  // -------------------------------------------------------------------
  const revealElements = document.querySelectorAll("[data-reveal]");

  if (revealElements.length && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    // Fallback: reveal everything immediately
    revealElements.forEach((el) => el.classList.add("revealed"));
  }

  // -------------------------------------------------------------------
  // 3. Hero video: slowed ~35% + ping-pong loop (forward ↔ reverse)
  // -------------------------------------------------------------------
  const heroVideo = document.querySelector(".hero__illustration video");
  if (heroVideo) {
    heroVideo.playbackRate = 0.65;
    heroVideo.loop = false;

    let reversing = false;
    let reverseRAF = null;
    let lastTimestamp = 0;

    // The threshold (in seconds before end) at which we switch to reverse.
    // Needs to be generous enough that we catch it before 'ended' fires.
    const END_THRESHOLD = 0.25;

    function startReverse() {
      if (reversing) return;
      reversing = true;
      heroVideo.pause();
      // Ensure currentTime is near the end (ended event may reset it)
      if (heroVideo.currentTime < 0.5) {
        heroVideo.currentTime = heroVideo.duration - 0.01;
      }
      lastTimestamp = 0;
      reverseRAF = requestAnimationFrame(reverseStep);
    }

    function reverseStep(timestamp) {
      if (!reversing) return;

      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
        reverseRAF = requestAnimationFrame(reverseStep);
        return;
      }

      const dt = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Rewind at 0.65x real-time speed to match the forward rate
      const rewindAmount = dt * 0.65;
      const newTime = heroVideo.currentTime - rewindAmount;

      if (newTime <= 0.05) {
        // Reached the start — switch back to forward
        heroVideo.currentTime = 0;
        reversing = false;
        heroVideo.play();
        return;
      }

      heroVideo.currentTime = newTime;
      reverseRAF = requestAnimationFrame(reverseStep);
    }

    // Detect near-end during forward playback
    heroVideo.addEventListener("timeupdate", () => {
      if (!reversing && heroVideo.duration &&
          heroVideo.currentTime >= heroVideo.duration - END_THRESHOLD) {
        startReverse();
      }
    });

    // Fallback: if timeupdate didn't catch it
    heroVideo.addEventListener("ended", () => {
      startReverse();
    });
  }

  // -------------------------------------------------------------------
  // 4. Smooth scroll for in-page anchor links (fallback for older browsers)
  // -------------------------------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
})();
