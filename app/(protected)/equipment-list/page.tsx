"use client"

import { useEffect, useMemo, useState } from "react"
import Header from "@/components/header"
import { ProjectSelector } from "@/components/project-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Package, Plus, Edit, Save, X, Trash2, DollarSign, MapPin, Wrench, Calendar, Users } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { EquipmentService, type Equipment } from "@/lib/equipment-service"
import { CrewService, type CrewMember } from "@/lib/crew-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { useAuthReady } from "@/components/auth-hooks"

export default function EquipmentListPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false)
  const [isCreatingEquipment, setIsCreatingEquipment] = useState(false)
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")

  // Form fields
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("")
  const [type, setType] = useState("")
  const [manufacturer, setManufacturer] = useState("")
  const [model, setModel] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [availableQuantity, setAvailableQuantity] = useState("1")
  const [ownershipType, setOwnershipType] = useState<string>("owned")
  const [rentalRateDaily, setRentalRateDaily] = useState("")
  const [rentalRateWeekly, setRentalRateWeekly] = useState("")
  const [rentalRateMonthly, setRentalRateMonthly] = useState("")
  const [rentalCompany, setRentalCompany] = useState("")
  const [rentalContact, setRentalContact] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [condition, setCondition] = useState<string>("excellent")
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState("")
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("")
  const [maintenanceNotes, setMaintenanceNotes] = useState("")
  const [storageLocation, setStorageLocation] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [locationId, setLocationId] = useState<string>("")
  const [crewMemberId, setCrewMemberId] = useState<string>("")
  const [availableFromDate, setAvailableFromDate] = useState("")
  const [availableToDate, setAvailableToDate] = useState("")
  const [unavailableDates, setUnavailableDates] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [status, setStatus] = useState<string>("available")

  const categories = [
    "Camera", "Lighting", "Sound", "Grip", "Electric", 
    "Lenses", "Support", "Accessories", "Vehicles", "Other"
  ]

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Load crew members and locations for dropdowns
        const [crew, locs] = await Promise.all([
          CrewService.getCrewMembers(projectId).catch(() => []),
          LocationsService.getLocations(projectId).catch(() => [])
        ])
        setCrewMembers(crew)
        setLocations(locs)

        // Load equipment
        setIsLoadingEquipment(true)
        const items = await EquipmentService.getEquipment(projectId)
        setEquipment(items)
      } catch (err) {
        console.error("Failed to load equipment data:", err)
        toast({
          title: "Error",
          description: "Failed to load equipment. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingEquipment(false)
        setLoading(false)
      }
    }
    if (ready && projectId) {
      load()
    }
  }, [projectId, ready, toast])

  // Filter equipment
  const filteredEquipment = useMemo(() => {
    let filtered = equipment
    if (filterCategory) {
      filtered = filtered.filter(e => e.category === filterCategory)
    }
    if (filterStatus) {
      filtered = filtered.filter(e => e.status === filterStatus)
    }
    return filtered
  }, [equipment, filterCategory, filterStatus])

  // Group by category
  const equipmentByCategory = useMemo(() => {
    const grouped: Record<string, Equipment[]> = {}
    filteredEquipment.forEach(item => {
      const cat = item.category || "Other"
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push(item)
    })
    return grouped
  }, [filteredEquipment])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setEditingEquipmentId(null)
    clearForm()
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("movie", id)
    } else {
      url.searchParams.delete("movie")
    }
    router.replace(url.toString())
  }

  const clearForm = () => {
    setName("")
    setCategory("")
    setType("")
    setManufacturer("")
    setModel("")
    setSerialNumber("")
    setQuantity("1")
    setAvailableQuantity("1")
    setOwnershipType("owned")
    setRentalRateDaily("")
    setRentalRateWeekly("")
    setRentalRateMonthly("")
    setRentalCompany("")
    setRentalContact("")
    setPurchaseDate("")
    setPurchasePrice("")
    setCondition("excellent")
    setLastMaintenanceDate("")
    setNextMaintenanceDate("")
    setMaintenanceNotes("")
    setStorageLocation("")
    setCurrentLocation("")
    setLocationId("")
    setCrewMemberId("")
    setAvailableFromDate("")
    setAvailableToDate("")
    setUnavailableDates("")
    setDescription("")
    setNotes("")
    setInternalNotes("")
    setStatus("available")
    setEditingEquipmentId(null)
  }

  const loadEquipmentIntoForm = (item: Equipment) => {
    setEditingEquipmentId(item.id)
    setName(item.name || "")
    setCategory(item.category || "")
    setType(item.type || "")
    setManufacturer(item.manufacturer || "")
    setModel(item.model || "")
    setSerialNumber(item.serial_number || "")
    setQuantity(item.quantity?.toString() || "1")
    setAvailableQuantity(item.available_quantity?.toString() || "1")
    setOwnershipType(item.ownership_type || "owned")
    setRentalRateDaily(item.rental_rate_daily?.toString() || "")
    setRentalRateWeekly(item.rental_rate_weekly?.toString() || "")
    setRentalRateMonthly(item.rental_rate_monthly?.toString() || "")
    setRentalCompany(item.rental_company || "")
    setRentalContact(item.rental_contact || "")
    setPurchaseDate(item.purchase_date || "")
    setPurchasePrice(item.purchase_price?.toString() || "")
    setCondition(item.condition || "excellent")
    setLastMaintenanceDate(item.last_maintenance_date || "")
    setNextMaintenanceDate(item.next_maintenance_date || "")
    setMaintenanceNotes(item.maintenance_notes || "")
    setStorageLocation(item.storage_location || "")
    setCurrentLocation(item.current_location || "")
    setLocationId(item.location_id || "")
    setCrewMemberId(item.crew_member_id || "")
    setAvailableFromDate(item.available_from_date || "")
    setAvailableToDate(item.available_to_date || "")
    setUnavailableDates((item.unavailable_dates || []).join(", "))
    setDescription(item.description || "")
    setNotes(item.notes || "")
    setInternalNotes(item.internal_notes || "")
    setStatus(item.status || "available")
  }

  const createOrUpdateEquipment = async () => {
    if (!projectId) return
    const nameValue = name.trim()
    if (!nameValue) {
      toast({ title: "Name required", description: "Please enter equipment name.", variant: "destructive" })
      return
    }
    if (!category) {
      toast({ title: "Category required", description: "Please select a category.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingEquipment(true)

      const parseDateArray = (str: string) => {
        if (!str.trim()) return undefined
        return str.split(",").map(s => s.trim()).filter(Boolean)
      }

      const equipmentData: any = {
        project_id: projectId,
        name: nameValue,
        category: category as Equipment['category'],
        type: type || undefined,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        serial_number: serialNumber || undefined,
        quantity: quantity ? parseInt(quantity) : 1,
        available_quantity: availableQuantity ? parseInt(availableQuantity) : undefined,
        ownership_type: ownershipType || undefined,
        rental_rate_daily: rentalRateDaily ? parseFloat(rentalRateDaily) : undefined,
        rental_rate_weekly: rentalRateWeekly ? parseFloat(rentalRateWeekly) : undefined,
        rental_rate_monthly: rentalRateMonthly ? parseFloat(rentalRateMonthly) : undefined,
        rental_company: rentalCompany || undefined,
        rental_contact: rentalContact || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        condition: condition || undefined,
        last_maintenance_date: lastMaintenanceDate || undefined,
        next_maintenance_date: nextMaintenanceDate || undefined,
        maintenance_notes: maintenanceNotes || undefined,
        storage_location: storageLocation || undefined,
        current_location: currentLocation || undefined,
        location_id: locationId || undefined,
        crew_member_id: crewMemberId || undefined,
        available_from_date: availableFromDate || undefined,
        available_to_date: availableToDate || undefined,
        unavailable_dates: parseDateArray(unavailableDates),
        description: description || undefined,
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        status: status || "available",
      }

      // Remove undefined values
      Object.keys(equipmentData).forEach(key => {
        if (equipmentData[key] === undefined) {
          delete equipmentData[key]
        }
      })

      if (editingEquipmentId) {
        const updated = await EquipmentService.updateEquipment(editingEquipmentId, equipmentData)
        setEquipment(prev => prev.map(e => e.id === editingEquipmentId ? updated : e))
        toast({ title: "Equipment updated", description: `"${updated.name}" saved.` })
      } else {
        const created = await EquipmentService.createEquipment(equipmentData)
        setEquipment([created, ...equipment])
        toast({ title: "Equipment added", description: `"${created.name}" added to inventory.` })
      }

      clearForm()
    } catch (err) {
      console.error('Create/update equipment failed:', err)
      toast({
        title: "Error",
        description: editingEquipmentId ? "Failed to update equipment." : "Failed to add equipment.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingEquipment(false)
    }
  }

  const deleteEquipment = async (id: string) => {
    if (!confirm("Delete this equipment? This cannot be undone.")) return
    try {
      await EquipmentService.deleteEquipment(id)
      setEquipment(prev => prev.filter(e => e.id !== id))
      if (editingEquipmentId === id) {
        clearForm()
      }
      toast({ title: "Deleted", description: "Equipment removed." })
    } catch (e) {
      console.error('Delete equipment failed:', e)
      toast({ title: "Error", description: "Failed to delete equipment.", variant: "destructive" })
    }
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'available': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'in_use': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'reserved': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'unavailable': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getConditionColor = (condition?: string | null) => {
    switch (condition) {
      case 'excellent': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'good': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'fair': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'poor': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'needs_repair': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getOwnershipColor = (type?: string | null) => {
    switch (type) {
      case 'owned': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'rented': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'borrowed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'leased': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-400 bg-clip-text text-transparent">
              Equipment List
            </h1>
            <p className="text-muted-foreground">
              Manage your production equipment inventory and track availability.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage equipment"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage equipment.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading equipment...
          </div>
        ) : (
          <>
            {/* Filters */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={filterCategory || "__all__"} onValueChange={(value) => setFilterCategory(value === "__all__" ? "" : value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus || "__all__"} onValueChange={(value) => setFilterStatus(value === "__all__" ? "" : value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All statuses</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in_use">In Use</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Create/Edit Form */}
            <Card className="cinema-card mb-6">
              <CardHeader>
                <CardTitle>
                  {editingEquipmentId ? "Edit Equipment" : "Add New Equipment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name/Model *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., ARRI Alexa Mini LF"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={category || "__none__"} onValueChange={(value) => setCategory(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="category" className="bg-input border-border">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Input
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Cinema Camera, LED Panel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input
                        id="manufacturer"
                        value={manufacturer}
                        onChange={(e) => setManufacturer(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., ARRI, Kino Flo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      <Input
                        id="model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Model number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serial">Serial Number</Label>
                      <Input
                        id="serial"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Serial number"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-input border-border min-h-[60px]"
                      placeholder="Equipment description and specifications..."
                    />
                  </div>
                </div>

                <Separator />

                {/* Quantity & Status */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Quantity & Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Total Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value)
                          if (!editingEquipmentId) {
                            setAvailableQuantity(e.target.value)
                          }
                        }}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="available-quantity">Available Quantity</Label>
                      <Input
                        id="available-quantity"
                        type="number"
                        min="0"
                        value={availableQuantity}
                        onChange={(e) => setAvailableQuantity(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status-select">Status</Label>
                      <Select value={status || "__available__"} onValueChange={(value) => setStatus(value === "__available__" ? "available" : value)}>
                        <SelectTrigger id="status-select" className="bg-input border-border">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="in_use">In Use</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                          <SelectItem value="unavailable">Unavailable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="condition-select">Condition</Label>
                      <Select value={condition || "__excellent__"} onValueChange={(value) => setCondition(value === "__excellent__" ? "excellent" : value)}>
                        <SelectTrigger id="condition-select" className="bg-input border-border">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">Excellent</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="poor">Poor</SelectItem>
                          <SelectItem value="needs_repair">Needs Repair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Ownership & Rental */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Ownership & Rental</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ownership-type">Ownership Type</Label>
                      <Select value={ownershipType || "__owned__"} onValueChange={(value) => setOwnershipType(value === "__owned__" ? "owned" : value)}>
                        <SelectTrigger id="ownership-type" className="bg-input border-border">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owned">Owned</SelectItem>
                          <SelectItem value="rented">Rented</SelectItem>
                          <SelectItem value="borrowed">Borrowed</SelectItem>
                          <SelectItem value="leased">Leased</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase-date">Purchase Date</Label>
                      <Input
                        id="purchase-date"
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase-price">Purchase Price ($)</Label>
                      <Input
                        id="purchase-price"
                        type="number"
                        step="0.01"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="bg-input border-border"
                        placeholder="0.00"
                      />
                    </div>
                    {(ownershipType === 'rented' || ownershipType === 'borrowed' || ownershipType === 'leased') && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="rental-company">Rental Company</Label>
                          <Input
                            id="rental-company"
                            value={rentalCompany}
                            onChange={(e) => setRentalCompany(e.target.value)}
                            className="bg-input border-border"
                            placeholder="Company name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rental-contact">Rental Contact</Label>
                          <Input
                            id="rental-contact"
                            value={rentalContact}
                            onChange={(e) => setRentalContact(e.target.value)}
                            className="bg-input border-border"
                            placeholder="Contact info"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rental-daily">Daily Rate ($)</Label>
                          <Input
                            id="rental-daily"
                            type="number"
                            step="0.01"
                            value={rentalRateDaily}
                            onChange={(e) => setRentalRateDaily(e.target.value)}
                            className="bg-input border-border"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rental-weekly">Weekly Rate ($)</Label>
                          <Input
                            id="rental-weekly"
                            type="number"
                            step="0.01"
                            value={rentalRateWeekly}
                            onChange={(e) => setRentalRateWeekly(e.target.value)}
                            className="bg-input border-border"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rental-monthly">Monthly Rate ($)</Label>
                          <Input
                            id="rental-monthly"
                            type="number"
                            step="0.01"
                            value={rentalRateMonthly}
                            onChange={(e) => setRentalRateMonthly(e.target.value)}
                            className="bg-input border-border"
                            placeholder="0.00"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Location & Assignment */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Location & Assignment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location-select">Location</Label>
                      <Select value={locationId || "__none__"} onValueChange={(value) => setLocationId(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="location-select" className="bg-input border-border">
                          <SelectValue placeholder="Select location (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crew-select">Crew Member (Owner)</Label>
                      <Select value={crewMemberId || "__none__"} onValueChange={(value) => setCrewMemberId(value === "__none__" ? "" : value)}>
                        <SelectTrigger id="crew-select" className="bg-input border-border">
                          <SelectValue placeholder="Select crew member (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {crewMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} - {member.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storage">Storage Location</Label>
                      <Input
                        id="storage"
                        value={storageLocation}
                        onChange={(e) => setStorageLocation(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Warehouse A, Unit 5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="current-location">Current Location</Label>
                      <Input
                        id="current-location"
                        value={currentLocation}
                        onChange={(e) => setCurrentLocation(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Where is it now?"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Availability */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Availability</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="available-from">Available From</Label>
                      <Input
                        id="available-from"
                        type="date"
                        value={availableFromDate}
                        onChange={(e) => setAvailableFromDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="available-to">Available To</Label>
                      <Input
                        id="available-to"
                        type="date"
                        value={availableToDate}
                        onChange={(e) => setAvailableToDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unavailable-dates">Unavailable Dates (comma-separated YYYY-MM-DD)</Label>
                      <Input
                        id="unavailable-dates"
                        value={unavailableDates}
                        onChange={(e) => setUnavailableDates(e.target.value)}
                        className="bg-input border-border"
                        placeholder="2025-01-15, 2025-01-20"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Maintenance */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Maintenance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="last-maintenance">Last Maintenance Date</Label>
                      <Input
                        id="last-maintenance"
                        type="date"
                        value={lastMaintenanceDate}
                        onChange={(e) => setLastMaintenanceDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="next-maintenance">Next Maintenance Date</Label>
                      <Input
                        id="next-maintenance"
                        type="date"
                        value={nextMaintenanceDate}
                        onChange={(e) => setNextMaintenanceDate(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="maintenance-notes">Maintenance Notes</Label>
                      <Textarea
                        id="maintenance-notes"
                        value={maintenanceNotes}
                        onChange={(e) => setMaintenanceNotes(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Maintenance history and notes..."
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Notes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Public Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-input border-border min-h-[80px]"
                        placeholder="General notes about the equipment..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="internal-notes">Internal Notes</Label>
                      <Textarea
                        id="internal-notes"
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        className="bg-input border-border min-h-[80px]"
                        placeholder="Private/internal notes (not shared)..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={createOrUpdateEquipment}
                    disabled={isCreatingEquipment || !name.trim() || !category}
                    className="gap-2"
                  >
                    {isCreatingEquipment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingEquipmentId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingEquipmentId ? "Update Equipment" : "Add Equipment"}
                  </Button>
                  {editingEquipmentId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingEquipment} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Equipment List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Equipment Inventory
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingEquipment
                    ? "Loading..."
                    : `${filteredEquipment.length} item${filteredEquipment.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingEquipment ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading equipment...
                  </div>
                ) : filteredEquipment.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No equipment yet. Add your first equipment item above.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(equipmentByCategory).map(([cat, items]) => (
                      <div key={cat} className="space-y-3">
                        <h3 className="text-lg font-semibold border-b border-border pb-2">
                          {cat} ({items.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item) => {
                            const owner = crewMembers.find(m => m.id === item.crew_member_id)
                            const location = locations.find(l => l.id === item.location_id)
                            return (
                              <div
                                key={item.id}
                                className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-base">{item.name}</h4>
                                      {item.manufacturer && item.model && (
                                        <p className="text-sm text-muted-foreground">
                                          {item.manufacturer} {item.model}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => loadEquipmentIntoForm(item)}
                                        title="Edit"
                                        className="h-7 w-7"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteEquipment(item.id)}
                                        title="Delete"
                                        className="h-7 w-7 text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1">
                                    <Badge className={getStatusColor(item.status)}>
                                      {item.status || 'available'}
                                    </Badge>
                                    <Badge className={getConditionColor(item.condition)}>
                                      {item.condition || 'excellent'}
                                    </Badge>
                                    <Badge className={getOwnershipColor(item.ownership_type)}>
                                      {item.ownership_type || 'owned'}
                                    </Badge>
                                  </div>

                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    {item.quantity && (
                                      <div className="flex items-center gap-1">
                                        <span>Qty: {item.quantity}</span>
                                        {item.available_quantity !== undefined && (
                                          <span>({item.available_quantity} available)</span>
                                        )}
                                      </div>
                                    )}
                                    {item.rental_rate_daily && (
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        <span>${item.rental_rate_daily}/day</span>
                                      </div>
                                    )}
                                    {owner && (
                                      <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        <span>{owner.name}</span>
                                      </div>
                                    )}
                                    {location && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        <span>{location.name}</span>
                                      </div>
                                    )}
                                    {item.storage_location && (
                                      <div className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        <span>{item.storage_location}</span>
                                      </div>
                                    )}
                                  </div>

                                  {item.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 pt-2 border-t border-border">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}





