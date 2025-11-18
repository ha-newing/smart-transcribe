import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TranscribePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("transcribe.title")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("transcribe.createProject")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Project creation and file upload will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
