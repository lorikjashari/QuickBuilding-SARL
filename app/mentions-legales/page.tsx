import type {Metadata} from "next";
import {InfoPage} from "@/components/info-page";
import "../info-page.css";
export const metadata: Metadata={title:"Mentions légales",description:"Mentions légales de Quick Building Sàrl."};
export default function LegalPage(){return <InfoPage kind="legal"/>}
