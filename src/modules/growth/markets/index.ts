import { dubaiMarket } from "./dubai";
import { erbilKriMarket } from "./erbil-kri";
import { franceMarket } from "./france";
import { istanbulMarket } from "./istanbul";
import { tehranMarket } from "./tehran";
import type { MarketProfile } from "./types";

export const marketProfiles = Object.freeze({
  "fr-france": franceMarket,
  "tr-istanbul": istanbulMarket,
  "iq-kri-erbil": erbilKriMarket,
  "ae-dubai": dubaiMarket,
  "ir-tehran": tehranMarket
} satisfies Record<MarketProfile["key"], MarketProfile>);

export type { MarketProfile } from "./types";
