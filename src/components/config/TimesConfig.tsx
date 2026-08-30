import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Users, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Shield, 
  HeadphonesIcon
} from "lucide-react";

// Import the new simplified component
import TimesConfigV3 from "./TimesConfigV3";

const TimesConfig = () => {
  // Just return the new simplified component
  return <TimesConfigV3 />;
};

export default TimesConfig;