/* Share verified Auth state with the existing public-page account links. */
import { initAuth } from "./js/api/auth.js";
import { initDatasetNavigation } from "./js/ui/navigation.js";
initDatasetNavigation();
initAuth().catch(() => {}); // The cabinet displays connection errors and a retry.
