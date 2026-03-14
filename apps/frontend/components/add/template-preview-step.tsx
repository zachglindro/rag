"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface TemplatePreviewStepProps {
  onBack: () => void
  onNext: () => void
}

// Hardcoded sample data for preview
const sampleData = [
  {
    local_name: "Tiniguib",
    plant_height: "185.3",
    tassel_color: "Purple",
    region_code: "CGUARD-IVB-0151",
    kernel_color: "white",
    kernel_type: "glutinous",
    province: "Romblon",
    municipality: "Santa Fe",
    barangay: "Purok 2",
    latitude: "12.5642",
    longitude: "121.9245",
    altitude: "340",
    collector_name: "Maria Santos",
    collection_date: "2019-03-15",
    remarks: "Good adaptation to local conditions",
    accession_number: "CGUARD N1",
    source_institute: "Phil Rice",
  },
  {
    local_name: "Langka",
    plant_height: "172.8",
    tassel_color: "Yellow",
    region_code: "CGUARD-IVB-0152",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Iloilo",
    municipality: "Jaro",
    barangay: "Dungon",
    latitude: "10.6945",
    longitude: "122.5615",
    altitude: "85",
    collector_name: "Juan Dela Cruz",
    collection_date: "2019-04-20",
    remarks: "High yield potential",
    accession_number: "CGUARD N2",
    source_institute: "IRRI",
  },
  {
    local_name: "Bigas Pula",
    plant_height: "195.1",
    tassel_color: "Purple",
    region_code: "CGUARD-IVB-0153",
    kernel_color: "red",
    kernel_type: "flint",
    province: "Negros Occidental",
    municipality: "Bacolod",
    barangay: "Mandalagan",
    latitude: "10.4072",
    longitude: "123.0048",
    altitude: "120",
    collector_name: "Rosa Gonzales",
    collection_date: "2019-05-10",
    remarks: "Drought tolerant",
    accession_number: "CGUARD N3",
    source_institute: "BSWM",
  },
  {
    local_name: "Mais Putih",
    plant_height: "182.5",
    tassel_color: "Green",
    region_code: "CGUARD-IVB-0154",
    kernel_color: "white",
    kernel_type: "dent",
    province: "Laguna",
    municipality: "Pagsanjan",
    barangay: "Talak",
    latitude: "14.3597",
    longitude: "121.6198",
    altitude: "75",
    collector_name: "Pedro Reyes",
    collection_date: "2019-06-05",
    remarks: "Early maturing variety",
    accession_number: "CGUARD N4",
    source_institute: "DA-RFO4A",
  },
  {
    local_name: "Sibuyan White",
    plant_height: "178.9",
    tassel_color: "Purple",
    region_code: "CGUARD-IVB-0155",
    kernel_color: "white",
    kernel_type: "flint",
    province: "Romblon",
    municipality: "Sibuyan",
    barangay: "Magdiwang",
    latitude: "12.6432",
    longitude: "122.1205",
    altitude: "180",
    collector_name: "Lucia Fernandez",
    collection_date: "2019-07-12",
    remarks: "Known for resilience",
    accession_number: "CGUARD N5",
    source_institute: "Phil Rice",
  },
  {
    local_name: "Iloco Yellow",
    plant_height: "190.2",
    tassel_color: "Yellow",
    region_code: "CGUARD-I-0156",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Ilocos Norte",
    municipality: "Laoag",
    barangay: "Tamag",
    latitude: "13.5933",
    longitude: "120.5500",
    altitude: "45",
    collector_name: "Francisco Marcos",
    collection_date: "2019-08-18",
    remarks: "Adapted to dry season",
    accession_number: "CGUARD N6",
    source_institute: "IRRI",
  },
  {
    local_name: "Baguio Purple",
    plant_height: "165.7",
    tassel_color: "Purple",
    region_code: "CGUARD-CAR-0157",
    kernel_color: "purple",
    kernel_type: "glutinous",
    province: "Benguet",
    municipality: "La Trinidad",
    barangay: "Camptown",
    latitude: "16.4123",
    longitude: "120.9453",
    altitude: "1340",
    collector_name: "Antonio Montoya",
    collection_date: "2019-09-22",
    remarks: "Highland variety, cold tolerant",
    accession_number: "CGUARD N7",
    source_institute: "BSWM",
  },
  {
    local_name: "Calamansi Corn",
    plant_height: "188.4",
    tassel_color: "Green",
    region_code: "CGUARD-IVB-0158",
    kernel_color: "yellow",
    kernel_type: "flint",
    province: "Quezon",
    municipality: "Lucena",
    barangay: "Maharlika",
    latitude: "13.9403",
    longitude: "121.6317",
    altitude: "95",
    collector_name: "Marta Villanueva",
    collection_date: "2019-10-14",
    remarks: "High starch content",
    accession_number: "CGUARD N8",
    source_institute: "DA-RFO4B",
  },
  {
    local_name: "Mindanao Red",
    plant_height: "185.6",
    tassel_color: "Purple",
    region_code: "CGUARD-XI-0159",
    kernel_color: "red",
    kernel_type: "dent",
    province: "Davao Oriental",
    municipality: "Mati",
    barangay: "Pandapan",
    latitude: "6.8167",
    longitude: "126.2167",
    altitude: "250",
    collector_name: "Salvador Cruz",
    collection_date: "2019-11-08",
    remarks: "Disease resistant",
    accession_number: "CGUARD N9",
    source_institute: "DA-XI",
  },
  {
    local_name: "Samar Gold",
    plant_height: "179.3",
    tassel_color: "Yellow",
    region_code: "CGUARD-VIII-0160",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Samar",
    municipality: "Calbayog",
    barangay: "Cabaguhan",
    latitude: "12.0667",
    longitude: "124.6000",
    altitude: "120",
    collector_name: "Constancia Reyes",
    collection_date: "2019-12-10",
    remarks: "Good for livestock feed",
    accession_number: "CGUARD N10",
    source_institute: "IRRI",
  },
  {
    local_name: "Bukidnon White",
    plant_height: "192.8",
    tassel_color: "Green",
    region_code: "CGUARD-X-0161",
    kernel_color: "white",
    kernel_type: "flint",
    province: "Bukidnon",
    municipality: "Malaybalay",
    barangay: "Casisang",
    latitude: "8.2372",
    longitude: "125.5092",
    altitude: "650",
    collector_name: "Romualdo Santos",
    collection_date: "2020-01-15",
    remarks: "Cooler climate adaptation",
    accession_number: "CGUARD N11",
    source_institute: "BSWM",
  },
  {
    local_name: "Panay Heritage",
    plant_height: "181.1",
    tassel_color: "Purple",
    region_code: "CGUARD-VI-0162",
    kernel_color: "white",
    kernel_type: "glutinous",
    province: "Capiz",
    municipality: "Roxas",
    barangay: "Dingle",
    latitude: "11.5915",
    longitude: "122.2872",
    altitude: "35",
    collector_name: "Victorino Aquino",
    collection_date: "2020-02-20",
    remarks: "Traditional farming variety",
    accession_number: "CGUARD N12",
    source_institute: "DA-RFO6",
  },
  {
    local_name: "Cotabato Mani",
    plant_height: "175.4",
    tassel_color: "Yellow",
    region_code: "CGUARD-XII-0163",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Cotabato",
    municipality: "Kidapawan",
    barangay: "Ising",
    latitude: "7.3186",
    longitude: "125.6165",
    altitude: "340",
    collector_name: "Erlinda Mateo",
    collection_date: "2020-03-12",
    remarks: "Oil seed type",
    accession_number: "CGUARD N13",
    source_institute: "MINDAMAIZE",
  },
  {
    local_name: "Nueva Ecija Gold",
    plant_height: "186.7",
    tassel_color: "Green",
    region_code: "CGUARD-III-0164",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Nueva Ecija",
    municipality: "Cabanatuan",
    barangay: "San Jose",
    latitude: "15.4908",
    longitude: "121.1747",
    altitude: "65",
    collector_name: "Artemio Bautista",
    collection_date: "2020-04-08",
    remarks: "Released variety",
    accession_number: "CGUARD N14",
    source_institute: "PhilMaize",
  },
  {
    local_name: "Surigao Pearl",
    plant_height: "180.2",
    tassel_color: "Purple",
    region_code: "CGUARD-XIII-0165",
    kernel_color: "white",
    kernel_type: "flint",
    province: "Surigao del Norte",
    municipality: "Surigao City",
    barangay: "Magallanes",
    latitude: "9.7644",
    longitude: "125.5071",
    altitude: "75",
    collector_name: "Celeste Monsod",
    collection_date: "2020-05-14",
    remarks: "Strong stalks",
    accession_number: "CGUARD N15",
    source_institute: "DA-XIII",
  },
  {
    local_name: "Palawan Sweet",
    plant_height: "177.9",
    tassel_color: "Yellow",
    region_code: "CGUARD-MIMAROPA-0166",
    kernel_color: "yellow",
    kernel_type: "sweet",
    province: "Palawan",
    municipality: "Puerto Princesa",
    barangay: "Mandala",
    latitude: "9.7404",
    longitude: "118.7254",
    altitude: "85",
    collector_name: "Bonifacio Tañedo",
    collection_date: "2020-06-19",
    remarks: "Sweet corn variety",
    accession_number: "CGUARD N16",
    source_institute: "IRRI",
  },
  {
    local_name: "Isabela Yellow",
    plant_height: "189.5",
    tassel_color: "Green",
    region_code: "CGUARD-II-0167",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Isabela",
    municipality: "Cauayan",
    barangay: "Minasa",
    latitude: "16.9739",
    longitude: "121.7545",
    altitude: "120",
    collector_name: "Godofredo Cruz",
    collection_date: "2020-07-25",
    remarks: "High-yielding",
    accession_number: "CGUARD N17",
    source_institute: "DA-II",
  },
  {
    local_name: "Antique Heirloom",
    plant_height: "183.6",
    tassel_color: "Purple",
    region_code: "CGUARD-VI-0168",
    kernel_color: "white",
    kernel_type: "glutinous",
    province: "Antique",
    municipality: "San Jose de Buenavista",
    barangay: "Bailan",
    latitude: "10.6389",
    longitude: "122.0728",
    altitude: "95",
    collector_name: "Segundina Marquez",
    collection_date: "2020-08-30",
    remarks: "Farmer-saved variety",
    accession_number: "CGUARD N18",
    source_institute: "DA-RFO6",
  },
  {
    local_name: "Leyte Masipag",
    plant_height: "187.2",
    tassel_color: "Yellow",
    region_code: "CGUARD-VIII-0169",
    kernel_color: "yellow",
    kernel_type: "dent",
    province: "Leyte",
    municipality: "Tacloban",
    barangay: "Santo Niño",
    latitude: "11.2709",
    longitude: "124.9864",
    altitude: "65",
    collector_name: "Rodolfo Lumbad",
    collection_date: "2020-09-12",
    remarks: "Participatory variety",
    accession_number: "CGUARD N19",
    source_institute: "MASIPAG",
  },
  {
    local_name: "Camiguin Black",
    plant_height: "174.8",
    tassel_color: "Purple",
    region_code: "CGUARD-X-0170",
    kernel_color: "black",
    kernel_type: "flint",
    province: "Camiguin",
    municipality: "Mambajao",
    barangay: "Agoho",
    latitude: "9.1340",
    longitude: "124.7281",
    altitude: "180",
    collector_name: "Enrique Diaz",
    collection_date: "2020-10-05",
    remarks: "Specialty crop",
    accession_number: "CGUARD N20",
    source_institute: "DA-X",
  },
]

export function TemplatePreviewStep({
  onBack,
  onNext,
}: TemplatePreviewStepProps) {
  const [visibleRows, setVisibleRows] = useState(10)

  const handleLoadMore = () => {
    setVisibleRows((prev) => Math.min(prev + 10, sampleData.length))
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium">Template Preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview how your data will look
        </p>
      </div>

      {/* Data table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Local Name</TableHead>
              <TableHead>Plant Height</TableHead>
              <TableHead>Tassel Color</TableHead>
              <TableHead>Kernel Color</TableHead>
              <TableHead>Kernel Type</TableHead>
              <TableHead>Province</TableHead>
              <TableHead>Municipality</TableHead>
              <TableHead>Barangay</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead>Altitude</TableHead>
              <TableHead>Collector</TableHead>
              <TableHead>Collection Date</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleData.slice(0, visibleRows).map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.local_name}</TableCell>
                <TableCell>{row.plant_height}</TableCell>
                <TableCell>{row.tassel_color}</TableCell>
                <TableCell>{row.kernel_color}</TableCell>
                <TableCell>{row.kernel_type}</TableCell>
                <TableCell>{row.province}</TableCell>
                <TableCell>{row.municipality}</TableCell>
                <TableCell>{row.barangay}</TableCell>
                <TableCell className="text-xs">{row.latitude}</TableCell>
                <TableCell className="text-xs">{row.longitude}</TableCell>
                <TableCell>{row.altitude}</TableCell>
                <TableCell className="text-sm">{row.collector_name}</TableCell>
                <TableCell className="text-sm">{row.collection_date}</TableCell>
                <TableCell className="text-sm">{row.remarks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load More button */}
      {visibleRows < sampleData.length && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} className="gap-2">
            More
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Start Ingestion</Button>
      </div>
    </div>
  )
}
