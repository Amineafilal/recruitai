import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Chargé en tout PREMIER import de index.ts. Les modules ESM sont évalués en
// profondeur dans l'ordre des imports : ce fichier (et donc dotenv) s'exécute
// avant que redis.ts ou queues.ts ne lisent process.env à leur chargement.
// Un simple `config()` en top-level de index.ts ne suffit pas : le code
// top-level tourne APRÈS l'évaluation de tous les imports.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
