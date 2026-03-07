import type { InputProps } from "ra-core";
import { useInput, useResourceContext, FieldTitle } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { formatPhoneDisplay, parsePhoneDigits, toE164 } from "./phoneUtils";

type PhoneInputProps = InputProps & {
  inputClassName?: string;
};

/**
 * Phone input that accepts numeric-only entry, displays formatted US phone
 * numbers as (XXX) XXX-XXXX, and stores in E.164 format (+1XXXXXXXXXX).
 */
export const PhoneInput = (props: PhoneInputProps) => {
  const resource = useResourceContext(props);
  const { label, source, className, inputClassName, helperText } = props;
  const { id, field, isRequired } = useInput({
    ...props,
    format: (value: string | null) => {
      if (!value) return "";
      return formatPhoneDisplay(parsePhoneDigits(value));
    },
    parse: (value: string) => {
      const digits = parsePhoneDigits(value);
      if (digits.length === 0) return null;
      if (digits.length >= 10) return toE164(digits);
      return digits; // partial entry, store digits for now
    },
  });

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          {...field}
          type="tel"
          placeholder="(555) 123-4567"
          className={inputClassName}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
