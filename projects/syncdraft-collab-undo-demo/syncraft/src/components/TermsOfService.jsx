import LegalLayout from './LegalLayout'
import { termsContent } from './legal.data'

export default function TermsOfService() {
  return (
    <LegalLayout
      title="Terms of Service"
      updatedAt="15 March 2026"
    >
      {termsContent}
    </LegalLayout>
  )
}
