import { useState } from "react";

import { showToast } from "@calcom/ui";

const useCalendlyImport = (userId: number) => {
  const [importing, setImporting] = useState(false);

  const importFromCalendly = async () => {
    if (importing) return;

    setImporting(true);

    const uri = `/api/import/calendly?userId=${userId}`;

    try {
      const response = await fetch(uri, {
        headers: {
          "Content-Type": "application/json",
        },
        method: "GET",
      });

      if (response.ok) {
        showToast("Data will import within 24 hours!", "success");
      } else {
        console.error("Error importing from Calendly");
        showToast("Failed to import data from Calendly", "error");
      }
    } catch (error) {
      console.error("Error importing from Calendly", error);
      showToast("Failed to import data from Calendly", "error");
    } finally {
      setImporting(false);
    }
  };

  return { importFromCalendly, importing };
};

export default useCalendlyImport;
