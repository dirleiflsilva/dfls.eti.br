/* -----------------------------------------------
/* How to use? : Check the GitHub README
/* ----------------------------------------------- */

/* To load a config file (particles.json) you need to host this demo (MAMP/WAMP/local)... */
/*
particlesJS.load('particles-js', 'particles.json', function() {
  console.log('particles.js loaded - callback');
});
*/

/* Otherwise just put the config content (json): */

(function () {
  var container = document.getElementById("particles-js");
  if (!container || typeof particlesJS !== "function") return;

  function currentTheme() {
    var html = document.documentElement;
    var stored = localStorage.getItem("pref-theme");

    if (stored === "dark" || stored === "light") return stored;
    if (html.dataset.theme === "dark" || html.dataset.theme === "light") return html.dataset.theme;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";

    return "light";
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^"|"$/g, "");
  }

  function buildConfig() {
    var isDark = currentTheme() === "dark";
    var particleColor = cssVar("--hero-particle") || (isDark ? "#9ff0c3" : "#ffffff");
    var particleOpacity = parseFloat(cssVar("--hero-particle-opacity") || (isDark ? "0.4" : "0.58"));

    return {
      particles: {
        number: {
          value: 100,
          density: {
            enable: true,
            value_area: 800
          }
        },
        color: {
          value: particleColor
        },
        shape: {
          type: "circle",
          stroke: {
            width: 0,
            color: "#000000"
          },
          polygon: {
            nb_sides: 5
          },
          image: {
            src: "img/github.svg",
            width: 100,
            height: 100
          }
        },
        opacity: {
          value: particleOpacity,
          random: false,
          anim: {
            enable: false,
            speed: 1,
            opacity_min: 0.1,
            sync: false
          }
        },
        size: {
          value: 3,
          random: true,
          anim: {
            enable: false,
            speed: 40,
            size_min: 0.1,
            sync: false
          }
        },
        line_linked: {
          enable: true,
          distance: 120,
          color: particleColor,
          opacity: particleOpacity * 0.7,
          width: 1
        },
        move: {
          enable: true,
          speed: 2.8,
          direction: "none",
          random: false,
          straight: false,
          out_mode: "out",
          attract: {
            enable: false,
            rotateX: 600,
            rotateY: 1200
          }
        }
      },
      interactivity: {
        detect_on: "canvas",
        events: {
          onhover: {
            enable: true,
            mode: "repulse"
          },
          onclick: {
            enable: true,
            mode: "push"
          },
          resize: true
        },
        modes: {
          grab: {
            distance: 400,
            line_linked: {
              opacity: 1
            }
          },
          bubble: {
            distance: 400,
            size: 40,
            duration: 2,
            opacity: 8,
            speed: 3
          },
          repulse: {
            distance: 200
          },
          push: {
            particles_nb: 4
          },
          remove: {
            particles_nb: 2
          }
        }
      },
      retina_detect: true
    };
  }

  function renderParticles() {
    if (window.pJSDom && window.pJSDom.length) {
      window.pJSDom.forEach(function (instance) {
        if (instance && instance.pJS && typeof instance.pJS.fn.vendors.destroypJS === "function") {
          instance.pJS.fn.vendors.destroypJS();
        }
      });
      window.pJSDom = [];
    }

    container.innerHTML = "";
    particlesJS("particles-js", buildConfig());
  }

  renderParticles();

  var observer = new MutationObserver(function () {
    renderParticles();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!localStorage.getItem("pref-theme")) {
      renderParticles();
    }
  });
})();
