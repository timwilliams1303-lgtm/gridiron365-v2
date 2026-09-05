"use client";

import {
  type ReactNode,
  useState,
} from "react";


type Props = {
  title: string;

  eyebrow: string;

  description?: string;

  defaultOpen?: boolean;

  danger?: boolean;

  children: ReactNode;
};


export default function NflPlayoffsCommissionerPanel({
  title,
  eyebrow,
  description,
  defaultOpen = false,
  danger = false,
  children,
}: Props) {
  const [
    open,
    setOpen,
  ] =
    useState(
      defaultOpen
    );


  return (
    <section
      style={{
        ...styles.panel,

        ...(danger
          ? styles.dangerPanel
          : {}),
      }}
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (
              current
            ) =>
              !current
          )
        }
        style={
          styles.header
        }
      >
        <div
          style={
            styles.headerText
          }
        >
          <span
            style={{
              ...styles.eyebrow,

              ...(danger
                ? styles.dangerEyebrow
                : {}),
            }}
          >
            {eyebrow}
          </span>


          <strong
            style={
              styles.title
            }
          >
            {title}
          </strong>


          {description ? (
            <span
              style={
                styles.description
              }
            >
              {description}
            </span>
          ) : null}
        </div>


        <span
          aria-hidden="true"
          style={{
            ...styles.chevron,

            transform:
              open
                ? "rotate(180deg)"
                : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>


      {open ? (
        <div
          style={
            styles.body
          }
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    panel: {
      overflow:
        "hidden",

      border:
        "1px solid rgba(255,255,255,.08)",

      borderRadius:
        16,

      background:
        "linear-gradient(180deg,#0c0e13,#090b0f)",
    },


    dangerPanel: {
      border:
        "1px solid rgba(235,65,65,.24)",
    },


    header: {
      width:
        "100%",

      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        16,

      padding:
        "17px 18px",

      border:
        0,

      background:
        "transparent",

      color:
        "#fff",

      cursor:
        "pointer",

      textAlign:
        "left",
    },


    headerText: {
      minWidth:
        0,

      display:
        "grid",

      gap:
        4,
    },


    eyebrow: {
      color:
        "#ff6828",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".12em",
    },


    dangerEyebrow: {
      color:
        "#ff7474",
    },


    title: {
      color:
        "#fff",

      fontSize:
        16,

      fontWeight:
        950,
    },


    description: {
      color:
        "#858e9c",

      fontSize:
        10,

      lineHeight:
        1.45,
    },


    chevron: {
      flex:
        "0 0 auto",

      color:
        "#ff6828",

      fontSize:
        11,

      transition:
        "transform .18s ease",
    },


    body: {
      padding:
        "0 16px 18px",

      borderTop:
        "1px solid rgba(255,255,255,.055)",
    },
  };