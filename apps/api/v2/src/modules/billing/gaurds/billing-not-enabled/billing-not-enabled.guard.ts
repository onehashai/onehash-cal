import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Observable } from "rxjs";

@Injectable()
export class BillingNotEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isBillingEnabled = this.config.get("isBillingEnabled");

    if (!isBillingEnabled) {
      throw new ForbiddenException("Billing not enabled.");
    }

    return isBillingEnabled;
  }
}
