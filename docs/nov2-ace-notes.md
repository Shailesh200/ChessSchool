# Nov 2 ace screens — map, review, class, gym

Branch `nov2/ace-map-review` is based on `origin/nov2/dex-mobile-kit-rc2` (`7b398e1`). `9f5a011` is not in this history.

Premium Illustrated UI is the default (`settings.uiKit === "premium"`). Classic academy, review, class, and lesson screens stay mounted when `uiKit` is `classic`.

Screenshots are 390 CSS pixels from Expo web (`/ace-preview`, `EXPO_PUBLIC_ACE_PREVIEW=1`). Compare images put the app on the left and the design PNG scaled to 390 on the right. Design PNGs in the tarball are 780px (2×).

## 03 course map

| State | App | Design | Compare |
| --- | --- | --- | --- |
| Normal | `docs/nov2-ace/shots/03-map.png` | `docs/nov2-ace/design/03-map.png` | `docs/nov2-ace/compare/03-map.png` |
| Dark | `docs/nov2-ace/shots/03-map-dark.png` | `docs/nov2-ace/design/03-map-dark.png` | `docs/nov2-ace/compare/03-map-dark.png` |
| Loading | `docs/nov2-ace/shots/03-map-loading.png` | `docs/nov2-ace/design/03-map-loading.png` | `docs/nov2-ace/compare/03-map-loading.png` |
| Empty | `docs/nov2-ace/shots/03-map-empty.png` | `docs/nov2-ace/design/03-map-empty.png` | `docs/nov2-ace/compare/03-map-empty.png` |
| Error | `docs/nov2-ace/shots/03-map-error.png` | `docs/nov2-ace/design/03-map-error.png` | `docs/nov2-ace/compare/03-map-error.png` |
| Offline | `docs/nov2-ace/shots/03-map-offline.png` | `docs/nov2-ace/design/03-map-offline.png` | `docs/nov2-ace/compare/03-map-offline.png` |

Wired from the Learn tab (`academy`) through `useLearnData`, progress due-count, and `useNetwork`. Gym is a row on the map and opens `/gym` (route lands with the gym screen). The Review tab badge uses the same due count. Offline lists the cached resume lesson and due review as ready, and locked nodes as needs-internet.

### Gaps

- Preview chips show 0 streak / 0 XP because the screenshot session has no progress snapshot. Live TopBar uses the signed-in streak and XP.
- Learn tab icon is the kit `bookOpen` mark. The HTML design draws a house.
- Coach line uses the full current class title (`Knight forks next…`). The HTML shortens it to `Forks next…`.
- Path shows the active semester, not every class in the stage. Extra academy actions (placement, homework, daily goal, search, resume match) sit under the map on the live screen and are hidden in the design shots (`chromeOnly`).
- Web Expo needs the Metro shim for the missing `@lottiefiles/dotlottie-react` peer and a single React copy. Native Lottie loader still plays; web screenshots use the still.
- Kit fonts load the bundled TTF files. The variable woff2 files are not shipped (Android Metro).
