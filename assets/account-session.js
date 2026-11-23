/* Share verified Auth state with the existing public-page account links. */
import { initAuth } from "./js/api/auth.js";
initAuth().catch(() => {}); // The cabinet displays connection errors and a retry.
