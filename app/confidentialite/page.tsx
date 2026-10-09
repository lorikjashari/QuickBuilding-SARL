import type {Metadata} from "next";
import {InfoPage} from "@/components/info-page";
import "../info-page.css";
export const metadata: Metadata={title:"Confidentialité",description:"Informations de confidentialité de Quick Building Sàrl."};
export default function PrivacyPage(){return <InfoPage kind="privacy"/>}
