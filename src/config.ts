import * as fs from "fs";

export interface StoredCredential {
  url: string;
  token: string;
  username: string;
  kind: number;
  navigatorIdentifier: string;
  deviceUUID: string;
}

export interface AccountConfig {
  prefix: string;
  username?: string;
  password?: string;
  cas?: string;
  parent?: boolean;
  child?: string;
  idp?: string;
  pin?: string;
  birthday_day?: string;
  birthday_month?: string;
  birthday_year?: string;
  // QR code fields from EDU login
  login?: string;
  jeton?: string;
  // Stored token credential
  credential?: StoredCredential;
}

export interface AppConfig {
  accounts: AccountConfig[];
  lessons: { days: number };
  homework: { days: number };
  information_and_surveys: { days: number };
  refresh_login?: number;
}

const CONFIG_JSON = "config/config.json";
const CONFIG_GENERATED_JSON = "config/config.generated.json";

const DEFAULT_CONFIG: Pick<AppConfig, "lessons" | "homework" | "information_and_surveys"> = {
  lessons: { days: 7 },
  homework: { days: 7 },
  information_and_surveys: { days: 7 },
};

export let config: AppConfig;

export function loadConfig(): AppConfig {
  let loaded: Partial<AppConfig>;
  if (fs.existsSync(CONFIG_GENERATED_JSON)) {
    loaded = JSON.parse(fs.readFileSync(CONFIG_GENERATED_JSON, "utf-8"));
  } else {
    loaded = JSON.parse(fs.readFileSync(CONFIG_JSON, "utf-8"));
  }
  config = { ...DEFAULT_CONFIG, ...loaded } as AppConfig;
  return config;
}

export function storeConfig(): void {
  fs.writeFileSync(CONFIG_GENERATED_JSON, JSON.stringify(config, null, 2));
}
