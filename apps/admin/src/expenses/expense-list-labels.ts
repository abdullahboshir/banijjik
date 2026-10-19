import type { Translator } from "@banijjik/i18n";
import type { ExpenseFormLabels } from "./expense-form-sheet";

export function formLabelsOf(t: Translator["t"]): ExpenseFormLabels {
  return {
    createTitle: t("expenses.form.createTitle"),
    close: t("expenses.form.close"),
    save: t("expenses.form.save"),
    amount: t("expenses.form.amount"),
    category: t("expenses.form.category"),
    paidVia: t("expenses.form.paidVia"),
    date: t("expenses.form.date"),
    location: t("expenses.form.location"),
    note: t("expenses.form.note"),
    attachments: t("expenses.form.attachments"),
    addPhoto: t("expenses.form.addPhoto"),
    removeAttachment: t("expenses.form.removeAttachment"),
    conflict: t("expenses.form.conflict"),
    reload: t("expenses.form.reload"),
    paidViaOptions: {
      CASH: t("expenses.paidVia.CASH"),
      BKASH: t("expenses.paidVia.BKASH"),
      NAGAD: t("expenses.paidVia.NAGAD"),
      BANK: t("expenses.paidVia.BANK"),
      CARD: t("expenses.paidVia.CARD"),
    },
  };
}
