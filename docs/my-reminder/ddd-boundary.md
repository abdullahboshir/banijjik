# 🛡️ Strict DDD Boundary Rules (Platinum Standard)

এই গাইডলাইনটি **Domain Layer**-এর পবিত্রতা রক্ষার জন্য। ডোমেইন লেয়ার হলো অ্যাপ্লিকেশনের হার্ট, যা বাইরের টেকনোলজি বা API সম্পর্কে কিছুই জানবে না।

### ⛔ NO-IMPORT ZONES (Domain Layer Only)

**Location:** `apps/backend/src/domains/*/domain/**/*`

<table width="100%">
  <thead>
    <tr>
      <th width="15%">📁 File Type</th>
      <th width="15%">📍 Location</th>
      <th width="35%">❌ STRICTLY FORBIDDEN (Do NOT Import)</th>
      <th width="35%">✅ ALLOWED (Safe to Import)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Entities</b></td>
      <td><code>*.entity.ts</code></td>
      <td>
        🔴 <code>@banijjik/contracts</code> (API)<br/>
        🔴 <code>@banijjik/validation</code> (Zod)<br/>
        🔴 <code>mongoose</code>, <code>typeorm</code> (DB)<br/>
        🔴 <code>express</code>, <code>nestjs</code> (Framework)<br/>
        🔴 <code>infrastructure/*</code><br/>
        🔴 <code>application/*</code>
      </td>
      <td>
        🟢 <code>../value-objects</code><br/>
        🟢 <code>../events</code><br/>
        🟢 <code>@shared/kernel</code> (Pure Utils)
      </td>
    </tr>
    <tr>
      <td><b>Value Objects</b></td>
      <td><code>*.vo.ts</code></td>
      <td>🚫 <b>SAME AS ABOVE</b></td>
      <td>
        🟢 Pure Primitives (<code>string</code>, <code>number</code>)<br/>
        🟢 Other Value Objects
      </td>
    </tr>
    <tr>
      <td><b>Policies</b></td>
      <td><code>*.policy.ts</code></td>
      <td>🚫 <b>SAME AS ABOVE</b></td>
      <td>
        🟢 Entities<br/>
        🟢 Value Objects<br/>
        🟢 Repository Interfaces
      </td>
    </tr>
    <tr>
      <td><b>Repository<br>Interfaces</b></td>
      <td><code>*.repository.ts</code></td>
      <td>🚫 <b>SAME AS ABOVE</b></td>
      <td>
        🟢 Entities<br/>
        🟢 Value Objects
      </td>
    </tr>
    <tr>
      <td><b>Events</b></td>
      <td><code>*.event.ts</code></td>
      <td>🚫 <b>SAME AS ABOVE</b></td>
      <td>
        🟢 Entities<br/>
        🟢 Value Objects
      </td>
    </tr>
  </tbody>
</table>

<br/>

---

### 💡 কেন এই কঠোর নিয়ম?

#### ১. Database Independence 💾

> **Scenario:** আপনি `Person` এনটিটির ভেতরে `mongoose` ইমপোর্ট করেছেন।

- **Problem:** কাল যদি `PostgreSQL` এ শিফট করতে চান, পুরো ডোমেইন কোড ভেঙে যাবে।
- **Rule:** এনটিটি জানবে না ডাটাবেজ কী।

#### ২. API Independence 🌐

> **Scenario:** আপনি `ProfileType` এনটিটির ভেতরে `@banijjik/contracts` থেকে এনাম ইমপোর্ট করেছেন।

- **Problem:** কাল যদি ফ্রন্টএন্ডের জন্য API-এর কোনো নাম চেঞ্জ করেন, ব্যাকএন্ডের বিজনেস লজিক এরর দিবে।
- **Rule:** বাইরের দুনিয়া (API) পাল্টালেও ডোমেইন তার খবরও পাবে না।

---

### ✅ The Golden Rule (Recap)

> **"Domain Layer only talks to itself."**
> <br>ডোমেইন লেয়ার শুধুমাত্র নিজের ভাই-বোনদের (Entities, VOs, Events) সাথে কথা বলে। সে বাইরের কোনো প্যাকেজ, লাইব্রেরি বা ফ্রেমওয়ার্ক চেনে না।
