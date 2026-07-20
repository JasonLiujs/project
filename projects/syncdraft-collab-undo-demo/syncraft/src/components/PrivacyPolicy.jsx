import LegalLayout from './LegalLayout'
import { privacyContent } from './legal.data'

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updatedAt="15 March 2026"
    >
      {privacyContent}
    </LegalLayout>
  )
}
