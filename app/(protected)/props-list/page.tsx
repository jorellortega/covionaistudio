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
import { Loader2, Box, Plus, Edit, Save, X, Trash2, DollarSign, MapPin, AlertTriangle, Calendar } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { PropsService, type Prop } from "@/lib/props-service"
import { LocationsService, type Location } from "@/lib/locations-service"
import { useAuthReady } from "@/components/auth-hooks"

export default function PropsListPage() {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProject = searchParams.get("movie") || ""
  const { user, userId, ready } = useAuthReady()

  const [projectId, setProjectId] = useState<string>(initialProject)
  const [loading, setLoading] = useState(false)
  const [props, setProps] = useState<Prop[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoadingProps, setIsLoadingProps] = useState(false)
  const [isCreatingProp, setIsCreatingProp] = useState(false)
  const [editingPropId, setEditingPropId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("")
  const [filterStatus, setFilterStatus] = useState<string>("")

  // Form fields
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("")
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [availableQuantity, setAvailableQuantity] = useState("1")
  const [ownershipType, setOwnershipType] = useState<string>("owned")
  const [rentalRateDaily, setRentalRateDaily] = useState("")
  const [rentalRateWeekly, setRentalRateWeekly] = useState("")
  const [rentalCompany, setRentalCompany] = useState("")
  const [rentalContact, setRentalContact] = useState("")
  const [purchaseDate, setPurchaseDate] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [vendor, setVendor] = useState("")
  const [condition, setCondition] = useState<string>("excellent")
  const [conditionNotes, setConditionNotes] = useState("")
  const [storageLocation, setStorageLocation] = useState("")
  const [currentLocation, setCurrentLocation] = useState("")
  const [locationId, setLocationId] = useState<string>("")
  const [usedInScenes, setUsedInScenes] = useState("")
  const [usedByCharacters, setUsedByCharacters] = useState("")
  const [availableFromDate, setAvailableFromDate] = useState("")
  const [availableToDate, setAvailableToDate] = useState("")
  const [unavailableDates, setUnavailableDates] = useState("")
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [specialHandling, setSpecialHandling] = useState("")
  const [safetyNotes, setSafetyNotes] = useState("")
  const [status, setStatus] = useState<string>("available")

  const categories = [
    "Furniture", "Electronics", "Clothing", "Weapons", "Vehicles",
    "Food", "Documents", "Artwork", "Decorative", "Tools", "Other"
  ]

  // Load data for selected project
  useEffect(() => {
    const load = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        // Load locations for dropdown
        const locs = await LocationsService.getLocations(projectId).catch(() => [])
        setLocations(locs)

        // Load props
        setIsLoadingProps(true)
        const items = await PropsService.getProps(projectId)
        setProps(items)
      } catch (err) {
        console.error("Failed to load props data:", err)
        toast({
          title: "Error",
          description: "Failed to load props. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingProps(false)
        setLoading(false)
      }
    }
    if (ready && projectId) {
      load()
    }
  }, [projectId, ready, toast])

  // Filter props
  const filteredProps = useMemo(() => {
    let filtered = props

    // Filter by category
    if (filterCategory) {
      filtered = filtered.filter(p => p.category === filterCategory)
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter(p => p.status === filterStatus)
    }

    return filtered
  }, [props, filterCategory, filterStatus])

  // Group by category
  const propsByCategory = useMemo(() => {
    const grouped: Record<string, Prop[]> = {}
    filteredProps.forEach(item => {
      const cat = item.category || "Other"
      if (!grouped[cat]) {
        grouped[cat] = []
      }
      grouped[cat].push(item)
    })
    return grouped
  }, [filteredProps])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setEditingPropId(null)
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
    setDescription("")
    setQuantity("1")
    setAvailableQuantity("1")
    setOwnershipType("owned")
    setRentalRateDaily("")
    setRentalRateWeekly("")
    setRentalCompany("")
    setRentalContact("")
    setPurchaseDate("")
    setPurchasePrice("")
    setVendor("")
    setCondition("excellent")
    setConditionNotes("")
    setStorageLocation("")
    setCurrentLocation("")
    setLocationId("")
    setUsedInScenes("")
    setUsedByCharacters("")
    setAvailableFromDate("")
    setAvailableToDate("")
    setUnavailableDates("")
    setNotes("")
    setInternalNotes("")
    setSpecialHandling("")
    setSafetyNotes("")
    setStatus("available")
    setEditingPropId(null)
  }

  const loadPropIntoForm = (prop: Prop) => {
    setEditingPropId(prop.id)
    setName(prop.name || "")
    setCategory(prop.category || "")
    setDescription(prop.description || "")
    setQuantity(prop.quantity?.toString() || "1")
    setAvailableQuantity(prop.available_quantity?.toString() || "1")
    setOwnershipType(prop.ownership_type || "owned")
    setRentalRateDaily(prop.rental_rate_daily?.toString() || "")
    setRentalRateWeekly(prop.rental_rate_weekly?.toString() || "")
    setRentalCompany(prop.rental_company || "")
    setRentalContact(prop.rental_contact || "")
    setPurchaseDate(prop.purchase_date || "")
    setPurchasePrice(prop.purchase_price?.toString() || "")
    setVendor(prop.vendor || "")
    setCondition(prop.condition || "excellent")
    setConditionNotes(prop.condition_notes || "")
    setStorageLocation(prop.storage_location || "")
    setCurrentLocation(prop.current_location || "")
    setLocationId(prop.location_id || "")
    setUsedInScenes((prop.used_in_scenes || []).join(", "))
    setUsedByCharacters((prop.used_by_characters || []).join(", "))
    setAvailableFromDate(prop.available_from_date || "")
    setAvailableToDate(prop.available_to_date || "")
    setUnavailableDates((prop.unavailable_dates || []).join(", "))
    setNotes(prop.notes || "")
    setInternalNotes(prop.internal_notes || "")
    setSpecialHandling(prop.special_handling || "")
    setSafetyNotes(prop.safety_notes || "")
    setStatus(prop.status || "available")
  }

  const createOrUpdateProp = async () => {
    if (!projectId) return
    const nameValue = name.trim()
    if (!nameValue) {
      toast({ title: "Name required", description: "Please enter a prop name.", variant: "destructive" })
      return
    }
    if (!category) {
      toast({ title: "Category required", description: "Please select a category.", variant: "destructive" })
      return
    }

    try {
      setIsCreatingProp(true)

      const parseArray = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean)
      const parseDateArray = (str: string) => {
        if (!str.trim()) return undefined
        return str.split(",").map(s => s.trim()).filter(Boolean)
      }

      const propData: any = {
        project_id: projectId,
        name: nameValue,
        category: category as Prop['category'],
        description: description || undefined,
        quantity: quantity ? parseInt(quantity) : 1,
        available_quantity: availableQuantity ? parseInt(availableQuantity) : undefined,
        ownership_type: ownershipType || undefined,
        rental_rate_daily: rentalRateDaily ? parseFloat(rentalRateDaily) : undefined,
        rental_rate_weekly: rentalRateWeekly ? parseFloat(rentalRateWeekly) : undefined,
        rental_company: rentalCompany || undefined,
        rental_contact: rentalContact || undefined,
        purchase_date: purchaseDate || undefined,
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        vendor: vendor || undefined,
        condition: condition || undefined,
        condition_notes: conditionNotes || undefined,
        storage_location: storageLocation || undefined,
        current_location: currentLocation || undefined,
        location_id: locationId || undefined,
        used_in_scenes: usedInScenes ? parseArray(usedInScenes) : undefined,
        used_by_characters: usedByCharacters ? parseArray(usedByCharacters) : undefined,
        available_from_date: availableFromDate || undefined,
        available_to_date: availableToDate || undefined,
        unavailable_dates: parseDateArray(unavailableDates),
        notes: notes || undefined,
        internal_notes: internalNotes || undefined,
        special_handling: specialHandling || undefined,
        safety_notes: safetyNotes || undefined,
        status: status || "available",
      }

      // Remove undefined values
      Object.keys(propData).forEach(key => {
        if (propData[key] === undefined) {
          delete propData[key]
        }
      })

      if (editingPropId) {
        const updated = await PropsService.updateProp(editingPropId, propData)
        setProps(prev => prev.map(p => p.id === editingPropId ? updated : p))
        toast({ title: "Prop updated", description: `"${updated.name}" saved.` })
      } else {
        const created = await PropsService.createProp(propData)
        setProps([created, ...props])
        toast({ title: "Prop added", description: `"${created.name}" added to inventory.` })
      }

      clearForm()
    } catch (err) {
      console.error('Create/update prop failed:', err)
      toast({
        title: "Error",
        description: editingPropId ? "Failed to update prop." : "Failed to add prop.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingProp(false)
    }
  }

  const deleteProp = async (id: string) => {
    if (!confirm("Delete this prop? This cannot be undone.")) return
    try {
      await PropsService.deleteProp(id)
      setProps(prev => prev.filter(p => p.id !== id))
      if (editingPropId === id) {
        clearForm()
      }
      toast({ title: "Deleted", description: "Prop removed." })
    } catch (e) {
      console.error('Delete prop failed:', e)
      toast({ title: "Error", description: "Failed to delete prop.", variant: "destructive" })
    }
  }

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'available': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'in_use': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'maintenance': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'reserved': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'damaged': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'unavailable': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getConditionColor = (condition?: string | null) => {
    switch (condition) {
      case 'excellent': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'good': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'fair': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'poor': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'damaged': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'needs_repair': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getOwnershipColor = (type?: string | null) => {
    switch (type) {
      case 'owned': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'rented': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'borrowed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'purchased': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'custom_made': return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
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
              Props List
            </h1>
            <p className="text-muted-foreground">
              Manage your production props inventory and track usage.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <ProjectSelector
            selectedProject={projectId}
            onProjectChange={handleProjectChange}
            placeholder="Select a movie to manage props"
          />
        </div>

        {!projectId ? (
          <Card className="cinema-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a movie to view and manage props.
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading props...
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
                        <SelectItem value="damaged">Damaged</SelectItem>
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
                  {editingPropId ? "Edit Prop" : "Add New Prop"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Vintage Typewriter"
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="bg-input border-border min-h-[80px]"
                      placeholder="Detailed description of the prop..."
                    />
                  </div>
                </div>

                <Separator />

                {/* Quantity & Status */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Quantity & Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Total Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value)
                          if (!editingPropId) {
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
                          <SelectItem value="damaged">Damaged</SelectItem>
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
                          <SelectItem value="damaged">Damaged</SelectItem>
                          <SelectItem value="needs_repair">Needs Repair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition-notes">Condition Notes</Label>
                    <Textarea
                      id="condition-notes"
                      value={conditionNotes}
                      onChange={(e) => setConditionNotes(e.target.value)}
                      className="bg-input border-border min-h-[60px]"
                      placeholder="Details about the condition..."
                    />
                  </div>
                </div>

                <Separator />

                {/* Ownership & Purchase */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Ownership & Purchase</h3>
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
                          <SelectItem value="purchased">Purchased</SelectItem>
                          <SelectItem value="custom_made">Custom Made</SelectItem>
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
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Where was it purchased?"
                      />
                    </div>
                    {(ownershipType === 'rented' || ownershipType === 'borrowed') && (
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
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Location & Usage */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Location & Usage</h3>
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
                      <Label htmlFor="storage">Storage Location</Label>
                      <Input
                        id="storage"
                        value={storageLocation}
                        onChange={(e) => setStorageLocation(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., Prop Warehouse, Unit 3"
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
                    <div className="space-y-2">
                      <Label htmlFor="used-in-scenes">Used in Scenes (comma-separated)</Label>
                      <Input
                        id="used-in-scenes"
                        value={usedInScenes}
                        onChange={(e) => setUsedInScenes(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., 1, 2A, 5"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="used-by-characters">Used by Characters (comma-separated)</Label>
                      <Input
                        id="used-by-characters"
                        value={usedByCharacters}
                        onChange={(e) => setUsedByCharacters(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g., John, Sarah, Detective"
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

                {/* Safety & Handling */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Safety & Handling</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="special-handling">Special Handling Instructions</Label>
                      <Textarea
                        id="special-handling"
                        value={specialHandling}
                        onChange={(e) => setSpecialHandling(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Special care instructions..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="safety-notes">Safety Notes</Label>
                      <Textarea
                        id="safety-notes"
                        value={safetyNotes}
                        onChange={(e) => setSafetyNotes(e.target.value)}
                        className="bg-input border-border min-h-[60px]"
                        placeholder="Important safety considerations..."
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
                        placeholder="General notes about the prop..."
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
                    onClick={createOrUpdateProp}
                    disabled={isCreatingProp || !name.trim() || !category}
                    className="gap-2"
                  >
                    {isCreatingProp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editingPropId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingPropId ? "Update Prop" : "Add Prop"}
                  </Button>
                  {editingPropId && (
                    <Button variant="outline" onClick={clearForm} disabled={isCreatingProp} className="gap-2">
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Props List */}
            <Card className="cinema-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  Props Inventory
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isLoadingProps
                    ? "Loading..."
                    : `${filteredProps.length} prop${filteredProps.length === 1 ? "" : "s"}`}
                </p>
              </CardHeader>
              <CardContent>
                {isLoadingProps ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading props...
                  </div>
                ) : filteredProps.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No props yet. Add your first prop above.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(propsByCategory).map(([cat, categoryProps]) => (
                      <div key={cat} className="space-y-3">
                        <h3 className="text-lg font-semibold border-b border-border pb-2">
                          {cat} ({categoryProps.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryProps.map((prop) => {
                            const location = locations.find(l => l.id === prop.location_id)
                            return (
                              <div
                                key={prop.id}
                                className="p-4 border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-base">{prop.name}</h4>
                                      {prop.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                          {prop.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => loadPropIntoForm(prop)}
                                        title="Edit"
                                        className="h-7 w-7"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteProp(prop.id)}
                                        title="Delete"
                                        className="h-7 w-7 text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1">
                                    <Badge className={getStatusColor(prop.status)}>
                                      {prop.status || 'available'}
                                    </Badge>
                                    <Badge className={getConditionColor(prop.condition)}>
                                      {prop.condition || 'excellent'}
                                    </Badge>
                                    <Badge className={getOwnershipColor(prop.ownership_type)}>
                                      {prop.ownership_type || 'owned'}
                                    </Badge>
                                  </div>

                                  <div className="space-y-1 text-xs text-muted-foreground">
                                    {prop.quantity && (
                                      <div>
                                        <span>Qty: {prop.quantity}</span>
                                        {prop.available_quantity !== undefined && (
                                          <span> ({prop.available_quantity} available)</span>
                                        )}
                                      </div>
                                    )}
                                    {prop.rental_rate_daily && (
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        <span>${prop.rental_rate_daily}/day</span>
                                      </div>
                                    )}
                                    {location && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        <span>{location.name}</span>
                                      </div>
                                    )}
                                    {prop.storage_location && (
                                      <div className="flex items-center gap-1">
                                        <Box className="h-3 w-3" />
                                        <span>{prop.storage_location}</span>
                                      </div>
                                    )}
                                    {prop.used_in_scenes && prop.used_in_scenes.length > 0 && (
                                      <div>
                                        <span>Scenes: {prop.used_in_scenes.join(", ")}</span>
                                      </div>
                                    )}
                                    {prop.used_by_characters && prop.used_by_characters.length > 0 && (
                                      <div>
                                        <span>Characters: {prop.used_by_characters.join(", ")}</span>
                                      </div>
                                    )}
                                  </div>

                                  {prop.safety_notes && (
                                    <div className="pt-2 border-t border-border">
                                      <div className="flex items-start gap-1 text-xs text-yellow-400">
                                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span className="line-clamp-2">{prop.safety_notes}</span>
                                      </div>
                                    </div>
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







