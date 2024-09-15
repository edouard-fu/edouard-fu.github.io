const navMenu = document.getElementById("nav-menu"),
  navToggle = document.getElementById("nav-toggle");

/* Toggle menu */
if (navToggle) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("show-menu");
  });
}
  // navClose = document.getElementById("nav-close");

// /* Menu show */
// if (navToggle) {
//   navToggle.addEventListener("click", () => {
//     navMenu.classList.add("show-menu");
//   });
// }

// /* Menu hidden */
// if (navClose) {
//   navClose.addEventListener("click", () => {
//     navMenu.classList.remove("show-menu");
//   });
// }
