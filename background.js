/* Service worker — giữ extension sống; logic chính ở content.js + popup.js */
chrome.runtime.onInstalled.addListener(function () {
  console.log("C2V Lọc Link sẵn sàng.");
});
