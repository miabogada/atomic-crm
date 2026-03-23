// @ts-expect-error Required for @react-pdf/renderer in Node (not detected by jsx: react-jsx)
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { AccountHistoryRow, InvoiceData } from "./types";
import styles from "./InvoiceStyles";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatCurrencyFixed(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Header({ data }: { data: InvoiceData }) {
  return (
    <View>
      {/* Row 1: Firm name + Account box */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.firmName}>
            Law Offices of Linnette Ta&ntilde;o Clark
          </Text>
          <Text style={styles.firmAddress}>
            715 S. Victory Blvd., Burbank, CA 91502
          </Text>
          <Text style={styles.firmPhone}>(213) 943-4550</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Account number */}
          <View style={styles.accountLabel}>
            <Text style={styles.accountLabelText}>Account</Text>
            <View style={styles.accountBox}>
              <Text style={styles.accountNumber}>{data.accountNumber}</Text>
            </View>
          </View>

          {/* Please pay this amount */}
          <View style={styles.payAmountBlock}>
            <Text style={styles.payLabel}>Please pay this amount:</Text>
            <Text style={styles.payLabel}>
              Por favor env&iacute;e esta cantidad:
            </Text>
            <View style={styles.amountBox}>
              <Text style={styles.amountText}>
                {formatCurrency(data.amountDue)}
              </Text>
            </View>
          </View>

          {/* Before / antes de */}
          <View style={styles.dueDateRow}>
            <Text style={styles.dueDateLabel}>before / antes de</Text>
            <View style={styles.dueDateBox}>
              <Text style={styles.dueDateText}>
                {formatDate(data.dueDate)}
              </Text>
            </View>
          </View>

          {/* Payment instructions */}
          <Text style={styles.paymentInstructions}>
            Please write Account # on your Check or Money Order (no cash)
          </Text>
          <Text style={styles.paymentInstructionsItalic}>
            Favor de escribir el # de Cuenta en su Cheque o Money Order (no
            efectivo)
          </Text>
        </View>
      </View>

      {/* Client address block */}
      <View style={styles.clientBlock}>
        <Text style={styles.clientName}>{data.clientName}</Text>
        <Text style={styles.clientAddress}>{data.clientStreet}</Text>
        <Text style={styles.clientAddress}>{data.clientCityStateZip}</Text>
      </View>

      {/* Detach line */}
      <View style={styles.detachLine}>
        <View style={styles.dashedBorder} />
        <Text style={styles.detachText}>
          (Please detach this section and send with your payment --- Por favor
          separe esta secci&oacute;n y env&iacute;ela con su pago)
        </Text>
        <View style={styles.dashedBorder} />
      </View>
    </View>
  );
}

function ContractSummary({ data }: { data: InvoiceData }) {
  return (
    <View style={styles.contractTable}>
      <Text style={styles.sectionHeader}>Contract Summary</Text>
      {/* Column headers */}
      <View style={styles.contractHeaderRow}>
        <Text style={styles.contractColDate}>Date</Text>
        <Text style={styles.contractColNumber}>Contract Number</Text>
        <Text style={styles.contractColDesc}> </Text>
        <Text style={styles.contractColFeeHeader}>Fee</Text>
      </View>
      {/* Rows */}
      {data.contracts.map((c, i) => (
        <View style={styles.contractRow} key={i}>
          <Text style={styles.contractColDate}>{formatDate(c.date)}</Text>
          <Text style={styles.contractColNumber}>{c.contractNumber}</Text>
          <Text style={styles.contractColDesc}>{c.description}</Text>
          <Text style={styles.contractColFee}>{formatCurrency(c.fee)}</Text>
        </View>
      ))}
    </View>
  );
}

function HistoryRow({ row }: { row: AccountHistoryRow }) {
  return (
    <View style={styles.historyRow}>
      {/* Date column — always present */}
      <Text style={styles.historyDueDate}>{formatDate(row.date)}</Text>

      {/* Payments Due columns */}
      <Text style={styles.historyDueScheduleId}>
        {row.due?.scheduleId ?? ""}
      </Text>
      <Text style={styles.historyDueLabel}>{row.due?.label ?? ""}</Text>
      <Text style={styles.historyDueAmount}>
        {row.due ? formatCurrency(row.due.amount) : ""}
      </Text>

      <Text style={styles.historySpacer}> </Text>

      {/* Payments Received columns */}
      <Text style={styles.historyReceivedAmount}>
        {row.received ? formatCurrency(row.received.amount) : ""}
      </Text>
      <Text style={styles.historyReceivedMethod}>
        {row.received?.method ?? ""}
      </Text>
      <Text style={styles.historyReceivedRef}>
        {row.received?.referenceNumber ?? ""}
      </Text>
    </View>
  );
}

function AccountHistory({ data }: { data: InvoiceData }) {
  return (
    <View>
      <Text style={styles.historyHeader}>
        Account History {"  "}
        <Text style={{ fontFamily: "Times-Bold", fontSize: 12 }}>
          {data.accountNumber}
        </Text>
      </Text>

      {/* Sub-headers */}
      <View style={styles.historySubHeader}>
        <View style={styles.historySubLeft}>
          <Text style={{ ...styles.historyColumnHeader, width: 60 }}> </Text>
          <Text style={{ ...styles.historyColumnHeader, width: 75 }}> </Text>
          <Text style={{ ...styles.historyColumnHeader, width: 80 }}>
            Payments Due
          </Text>
          <Text style={{ ...styles.historyColumnHeader, width: 50 }}> </Text>
        </View>
        <View style={styles.historySubRight}>
          <Text style={{ ...styles.historyColumnHeader, width: 15 }}> </Text>
          <Text style={styles.historyColumnHeader}>Payments Received</Text>
        </View>
      </View>

      {/* History rows */}
      {data.history.map((row, i) => (
        <HistoryRow key={i} row={row} />
      ))}

      {/* Account Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Account Balance:</Text>
        <Text style={styles.balanceAmount}>
          {formatCurrencyFixed(data.accountBalance)}
        </Text>
      </View>
    </View>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document
      title={`Invoice - ${data.accountNumber}`}
      author="Law Offices of Linnette Taño Clark"
    >
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <ContractSummary data={data} />
        <AccountHistory data={data} />
      </Page>
    </Document>
  );
}
