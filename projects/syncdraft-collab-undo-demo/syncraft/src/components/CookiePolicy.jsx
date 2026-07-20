    import LegalLayout from './LegalLayout'
import { cookieContent } from './legal.data'

export default function CookiePolicy() {
  return (
    <LegalLayout
      title="Cookie Policy"
      updatedAt="15 March 2026"
    >
      {cookieContent}
    </LegalLayout>
  )
}
