import type { ReactElement } from "react";
import { SmsGatewayPage } from "../../../src/sms-gateway/sms-gateway-page";

export default async function SmsGatewayRoute(): Promise<ReactElement> {
  return <SmsGatewayPage />;
}
