import { DocumentType } from "@cloudcommerce/types";

export const documentPrefix = (type: DocumentType): string => {
  switch (type) {
    case DocumentType.REMITO:
      return "R";
    case DocumentType.FACTURA:
      return "FA";
    case DocumentType.NOTA_CREDITO:
      return "NC";
  }
};

export const formatDocumentDisplayNumber = (type: DocumentType, number: number): string =>
  `${documentPrefix(type)}-${String(number).padStart(4, "0")}`;
