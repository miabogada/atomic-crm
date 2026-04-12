import { StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
  },

  // --- Header ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  firmName: {
    fontFamily: "Times-BoldItalic",
    fontSize: 14,
  },
  firmAddress: {
    fontFamily: "Times-Italic",
    fontSize: 9,
  },
  firmPhone: {
    fontFamily: "Times-Italic",
    fontSize: 9,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  accountLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  accountLabelText: {
    fontFamily: "Times-Italic",
    fontSize: 11,
    marginRight: 4,
  },
  accountBox: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accountNumber: {
    fontFamily: "Times-BoldItalic",
    fontSize: 11,
  },
  payAmountBlock: {
    alignItems: "flex-end",
    marginTop: 2,
  },
  payLabel: {
    fontFamily: "Times-BoldItalic",
    fontSize: 10,
    textAlign: "right",
  },
  amountBox: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 1,
  },
  amountText: {
    fontFamily: "Times-Bold",
    fontSize: 12,
  },
  dueDateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
  },
  dueDateLabel: {
    fontFamily: "Times-BoldItalic",
    fontSize: 10,
    marginRight: 4,
  },
  dueDateBox: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dueDateText: {
    fontFamily: "Times-Bold",
    fontSize: 10,
  },
  paymentInstructions: {
    fontSize: 7,
    textAlign: "right",
    marginTop: 2,
  },
  paymentInstructionsItalic: {
    fontFamily: "Times-Italic",
    fontSize: 7,
    textAlign: "right",
  },

  // --- Client address ---
  clientBlock: {
    marginTop: 16,
    marginBottom: 16,
    marginLeft: 40,
  },
  clientName: {
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clientAddress: {
    fontSize: 12,
    textTransform: "uppercase",
  },

  // --- Detach line ---
  detachLine: {
    marginTop: 10,
    marginBottom: 10,
  },
  detachText: {
    fontFamily: "Times-Italic",
    fontSize: 8,
    textAlign: "center",
    marginBottom: 4,
  },
  detachHyphens: {
    fontSize: 8,
  },

  // --- Contract Summary ---
  sectionHeader: {
    fontFamily: "Times-BoldItalic",
    fontSize: 11,
    marginBottom: 4,
    textDecoration: "underline",
  },
  contractTable: {
    marginBottom: 8,
  },
  contractHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000",
    paddingBottom: 2,
    marginBottom: 2,
  },
  contractRow: {
    flexDirection: "row",
    paddingVertical: 1,
  },
  contractColDate: {
    width: 65,
    fontFamily: "Times-Italic",
    fontSize: 9,
  },
  contractColNumber: {
    width: 120,
    fontSize: 9,
  },
  contractColDesc: {
    flex: 1,
    fontSize: 9,
  },
  contractColFee: {
    width: 70,
    textAlign: "right",
    fontSize: 9,
    borderLeftWidth: 0.5,
    borderLeftColor: "#999",
    borderRightWidth: 0.5,
    borderRightColor: "#999",
    paddingHorizontal: 4,
  },
  contractColFeeHeader: {
    width: 70,
    textAlign: "center",
    fontFamily: "Times-Italic",
    fontSize: 9,
    borderLeftWidth: 0.5,
    borderLeftColor: "#999",
    borderRightWidth: 0.5,
    borderRightColor: "#999",
    paddingHorizontal: 4,
  },

  // --- Account History ---
  historyHeader: {
    fontFamily: "Times-BoldItalic",
    fontSize: 11,
    marginBottom: 4,
    textDecoration: "underline",
  },
  historySubHeader: {
    flexDirection: "row",
    marginBottom: 2,
  },
  historySubLeft: {
    width: "50%",
    flexDirection: "row",
  },
  historySubRight: {
    width: "50%",
    flexDirection: "row",
  },
  historyColumnHeader: {
    fontFamily: "Times-BoldItalic",
    fontSize: 9,
  },
  historyRow: {
    flexDirection: "row",
    paddingVertical: 0.5,
  },
  // Left side: Payments Due columns
  historyDueDate: {
    width: 60,
    fontSize: 8,
  },
  historyDueScheduleId: {
    width: 75,
    fontSize: 8,
  },
  historyDueLabel: {
    width: 80,
    fontSize: 8,
  },
  historyDueAmount: {
    width: 50,
    textAlign: "right",
    fontSize: 8,
  },
  // Spacer between left and right
  historySpacer: {
    width: 15,
  },
  // Right side: Payments Received columns
  historyReceivedDate: {
    width: 0, // date is shared from left column
  },
  historyReceivedAmount: {
    width: 50,
    textAlign: "right",
    fontSize: 8,
  },
  historyReceivedMethod: {
    width: 70,
    textAlign: "center",
    fontSize: 8,
  },
  historyReceivedRef: {
    width: 80,
    fontSize: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: "#999",
    paddingLeft: 6,
  },

  // --- Account Balance ---
  balanceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#000",
  },
  balanceLabel: {
    fontFamily: "Times-BoldItalic",
    fontSize: 10,
    marginRight: 8,
  },
  balanceAmount: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    width: 80,
    textAlign: "right",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 1,
  },
});

export default styles;
